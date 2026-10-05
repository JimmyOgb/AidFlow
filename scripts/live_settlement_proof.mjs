// Usage:
//   node scripts/live_settlement_proof.mjs pass
//   node scripts/live_settlement_proof.mjs fail <campaignId> <donorPreClaimWei>
// Writes JSON evidence to artifacts/live_settlement_<mode>.json
import { createAccount, createClient, chains } from "../frontend/node_modules/genlayer-js/dist/index.js";
import { createRequire } from "module";
import fs from "fs";
import { submitGenLayerWrite, genlayerCall, getContractAddress } from "../frontend/src/lib/genlayer.ts";

const require = createRequire(import.meta.url);
const RPC = "https://studio.genlayer.com/api";
const CONTRACT = getContractAddress();
const AMOUNT = 100000000000000000n; // 0.1 GEN

// Independent balance read: raw JSON-RPC eth_getBalance (not via the write path).
async function rawBalance(addr) {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [addr, "latest"] }),
  });
  const j = await r.json();
  return BigInt(j.result);
}

async function key() {
  const pk = process.env.STUDIONET_PRIVATE_KEY || process.env.GENLAYER_PRIVATE_KEY;
  if (pk) return pk.trim();
  const keytar = require("C:/Users/NO GO NO/AppData/Roaming/npm/node_modules/genlayer/node_modules/keytar");
  return (await keytar.getPassword("genlayer-cli", "account:ace-deployer")).trim();
}

const mk = (acct) => createClient({ endpoint: RPC, chain: chains.studionet, account: acct });

async function write(client, functionName, args = [], value = 0n) {
  const r = await submitGenLayerWrite({ functionName, args, value, client, onStatusChange: (s) => console.log(`  [${s}]`) });
  const rd = r.receipt?.lastRound || r.receipt?.last_round || {};
  const out = {
    functionName,
    txId: r.txId,
    status: r.statusName,
    result: r.resultName,
    execution: r.executionResultName,
    isSuccess: r.isSuccess,
    validators: (rd.round_validators || []).length,
    votes: `${rd.votes_committed}/${rd.votes_revealed}`,
  };
  console.log(JSON.stringify(out));
  return out;
}

async function claimables(addr, client) {
  const b = await genlayerCall("get_claimable_balances", [addr], client);
  return { org_claimable: BigInt(b?.org_claimable || 0), donor_claimable: BigInt(b?.donor_claimable || 0) };
}

const ser = (o) => JSON.stringify(o, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);

async function main() {
  const mode = process.argv[2];
  const donor = createAccount(await key());
  const donorClient = mk(donor);
  const ev = { mode, contract: CONTRACT, rpc: RPC, chainId: 61999, steps: [] };

  if (mode === "pass") {
    const org = createAccount();
    const orgClient = mk(org);
    ev.donor = donor.address;
    ev.org = org.address;
    const count = BigInt(await genlayerCall("get_campaign_count", [], donorClient));
    ev.steps.push(await write(donorClient, "create_campaign", [
      org.address,
      `AidFlow PASS settlement ${Date.now()}`,
      "Settlement proof campaign (PASS branch).",
      [AMOUNT],
      ["Deliver 100 medical kits to the central clinic and obtain a signed beneficiary receipt"],
      ["2026-12-31"],
      ["PASS if the evidence includes a supplier invoice, a delivery receipt, and a beneficiary distribution list/sign-off that together show the 100 kits were delivered."],
    ]));
    const id = count;
    ev.campaignId = id.toString();
    ev.steps.push(await write(donorClient, "fund_campaign", [id], AMOUNT));
    const evidences = [
      ["RECEIPT", "invoice://supplier/INV-2026-0881", "0x" + "a1".repeat(32), "Supplier invoice INV-2026-0881: 100 medical kits purchased and paid in full."],
      ["RECEIPT", "receipt://clinic/DEL-881", "0x" + "b2".repeat(32), "Clinic delivery receipt DEL-881 signed by Dr. Elena Vance: 100 of 100 kits received and counted."],
      ["RECEIPT", "list://clinic/distribution-881", "0x" + "c3".repeat(32), "Beneficiary distribution list and sign-off: all 100 kits distributed to registered patients, confirmed by clinic director."],
    ];
    for (const [t, u, h, d] of evidences) {
      ev.steps.push(await write(orgClient, "submit_evidence", [id, 0n, t, u, h, d, new Date().toISOString()]));
    }
    let status = null;
    for (let i = 0; i < 3; i++) {
      ev.steps.push(await write(donorClient, "adjudicate_milestone", [id, 0n]));
      const m = await genlayerCall("get_milestone", [id, 0n], donorClient);
      status = m?.status;
      console.log("  milestone status:", status);
      if (status === "PASSED") break;
    }
    ev.adjudicationStatus = status;
    if (status !== "PASSED") {
      fs.writeFileSync("artifacts/live_settlement_pass.json", ser(ev));
      throw new Error(`PASS adjudication ended as ${status}`);
    }
    ev.steps.push(await write(donorClient, "release_milestone", [id, 0n]));
    const claimBefore = await claimables(org.address, donorClient);
    const escrowPre = await rawBalance(CONTRACT);
    const orgPre = await rawBalance(org.address);
    ev.pre = { claimable: claimBefore, escrow: escrowPre, orgEOA: orgPre };
    ev.steps.push(await write(orgClient, "claim_payout", []));
    // Independent post-finality reads
    const orgPost = await rawBalance(org.address);
    const escrowPost = await rawBalance(CONTRACT);
    const claimAfter = await claimables(org.address, donorClient);
    ev.post = { claimable: claimAfter, escrow: escrowPost, orgEOA: orgPost };
    ev.checks = {
      eoaDelta: (orgPost - orgPre).toString(),
      eoaDeltaEqualsClaimable: orgPost - orgPre === claimBefore.org_claimable,
      escrowDelta: (escrowPost - escrowPre).toString(),
      escrowDecreasedByClaim: escrowPre - escrowPost === claimBefore.org_claimable,
      claimableZero: claimAfter.org_claimable === 0n,
    };
    const second = await write(orgClient, "claim_payout", []);
    const orgAfter2 = await rawBalance(org.address);
    ev.secondClaim = { ...second, rejected: !second.isSuccess, eoaUnchanged: orgAfter2 === orgPost };
  } else if (mode === "fail") {
    const id = BigInt(process.argv[3]);
    const preClaim = BigInt(process.argv[4]);
    const post = await rawBalance(donor.address);
    const escrow = await rawBalance(CONTRACT);
    const cl = await claimables(donor.address, donorClient);
    ev.campaignId = id.toString();
    ev.donor = donor.address;
    ev.pre = { donorEOA: preClaim };
    ev.post = { donorEOA: post, escrow, claimable: cl };
    ev.checks = { eoaDelta: (post - preClaim).toString(), claimableZero: cl.donor_claimable === 0n };
    const second = await write(donorClient, "claim_refund", []);
    const post2 = await rawBalance(donor.address);
    ev.secondClaim = { ...second, rejected: !second.isSuccess, eoaUnchanged: post2 === post };
  }
  fs.writeFileSync(`artifacts/live_settlement_${mode}.json`, ser(ev));
  console.log(ser(ev));
}

main().catch((e) => { console.error(e); process.exit(1); });
