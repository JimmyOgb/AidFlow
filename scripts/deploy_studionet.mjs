import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createAccount, createClient, chains, isSuccessful } from "../frontend/node_modules/genlayer-js/dist/index.js";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

async function resolveSenderKey() {
  let pk = process.env.STUDIONET_PRIVATE_KEY || process.env.GENLAYER_PRIVATE_KEY;
  if (pk && pk.trim().length > 0) return pk.trim();
  try {
    const keytar = require("C:/Users/NO GO NO/AppData/Roaming/npm/node_modules/genlayer/node_modules/keytar");
    const key = await keytar.getPassword("genlayer-cli", "account:ace-deployer");
    if (key && key.trim().length > 0) return key.trim();
  } catch (err) {
    console.warn("Keytar resolution note:", err.message);
  }
  throw new Error("Could not resolve StudioNet private key");
}

async function main() {
  console.log("=" * 60);
  console.log(" AidFlow Protocol: StudioNet Live Contract Deployment");
  console.log("=" * 60);

  const pk = await resolveSenderKey();
  const account = createAccount(pk);
  console.log("Deployer Address:", account.address);

  const client = createClient({
    chain: chains.studionet,
    endpoint: "https://studio.genlayer.com/api",
    account,
  });

  const contractPath = path.resolve(__dirname, "../contracts/aidflow.py");
  const code = fs.readFileSync(contractPath, "utf-8");
  console.log(`Loaded contract code (${code.length} bytes) from ${contractPath}`);

  console.log("\nSubmitting deployment transaction to StudioNet...");
  const txHash = await client.deployContract({
    code,
    args: [],
    leaderOnly: false,
  });
  console.log(`Deployment transaction submitted successfully! Tx ID / Hash: ${txHash}`);

  console.log("\nWaiting for deployment transaction finalization on StudioNet...");
  let receipt = null;
  for (let i = 0; i < 40; i++) {
    try {
      receipt = await client.getTransactionReceipt({ hash: txHash });
      const status = receipt?.status;
      console.log(`[Attempt ${i + 1}/40] Status: ${status} (Name: ${receipt?.statusName || status})`);
      if (status === "FINALIZED" || status === 5 || receipt?.statusName === "FINALIZED") {
        break;
      }
    } catch (e) {
      console.log(`[Attempt ${i + 1}/40] Waiting for receipt... (${e.message})`);
    }
    await new Promise((r) => setTimeout(r, 4000));
  }

  console.log("\nDeployment Final Receipt Summary:");
  console.log("  Status:", receipt?.status, `(${receipt?.statusName})`);
  console.log("  Result:", receipt?.result, `(${receipt?.resultName})`);
  console.log("  Execution Result:", receipt?.txExecutionResult, `(${receipt?.txExecutionResultName})`);

  // Extract deployed contract address
  let contractAddress =
    receipt?.data?.contract_address ||
    receipt?.contractAddress ||
    receipt?.recipient ||
    receipt?.data?.contractAddress;

  if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
    // If not in receipt top-level, query the transaction details from RPC directly
    const rpcRes = await fetch("https://studio.genlayer.com/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "gen_getTransaction",
        params: [txHash],
      }),
    });
    const rpcJson = await rpcRes.json();
    console.log("gen_getTransaction RPC Result:", JSON.stringify(rpcJson, null, 2));
    contractAddress =
      rpcJson?.result?.data?.contract_address ||
      rpcJson?.result?.contract_address ||
      rpcJson?.result?.recipient;
  }

  console.log("\n============================================================");
  console.log(" NEW DEPLOYED CONTRACT ADDRESS:", contractAddress);
  console.log("============================================================");

  if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("Could not determine new contract address from deployment receipt!");
  }

  // Verify the deployed contract interface matches local source
  console.log("\nVerifying deployed contract schema against local source...");
  const schemaRes = await fetch("https://studio.genlayer.com/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "gen_getContractSchema",
      params: [contractAddress],
    }),
  });
  const schemaJson = await schemaRes.json();
  const methods = Object.keys(schemaJson?.result?.methods || {});
  console.log(`Deployed contract methods (${methods.length}):`, methods);

  const requiredMethods = [
    "create_campaign",
    "fund_campaign",
    "submit_evidence",
    "adjudicate_milestone",
    "release_milestone",
    "refund_campaign",
    "claim_payout",
    "claim_refund",
    "verify_proposal",
    "get_campaign",
    "get_campaign_count",
    "get_campaign_milestones",
    "get_milestone",
    "get_milestone_evidence",
    "get_claimable_balances",
    "get_contributor_amount",
    "is_campaign_refundable",
    "get_verified_payload_hash",
    "is_payload_hash_verified",
    "get_latest_verified_hash",
  ];

  for (const rm of requiredMethods) {
    if (!methods.includes(rm)) {
      throw new Error(`Deployed contract is missing expected method: ${rm}`);
    }
  }
  console.log("✓ All 20 methods present on deployed contract schema!");

  // Save new deployment manifest
  const manifest = {
    network: "studionet",
    contract: "AidFlow",
    contract_address: contractAddress,
    chainId: 61999,
    rpcUrl: "https://studio.genlayer.com/api",
    explorerUrl: "https://studio.genlayer.com/",
    transaction_hash: txHash,
    contract_file: "contracts/aidflow.py",
    deployed_at: new Date().toISOString(),
  };

  const rootManifestPath = path.resolve(__dirname, "../deployed_contract.json");
  const frontendManifestPath = path.resolve(__dirname, "../frontend/src/contracts/deployed_contract.json");

  fs.writeFileSync(rootManifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Saved manifest to ${rootManifestPath}`);

  if (fs.existsSync(path.dirname(frontendManifestPath))) {
    fs.writeFileSync(frontendManifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Saved manifest to ${frontendManifestPath}`);
  }

  return manifest;
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
