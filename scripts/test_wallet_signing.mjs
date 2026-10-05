import { createAccount } from "../frontend/node_modules/genlayer-js/dist/index.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const keytar = require("C:/Users/NO GO NO/AppData/Roaming/npm/node_modules/genlayer/node_modules/keytar");
const key = await keytar.getPassword("genlayer-cli", "account:ace-deployer");
const account = createAccount(key);

async function testSign() {
  console.log("Account address:", account.address);
  // Fetch current nonce
  const nonceRes = await fetch("https://studio.genlayer.com/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionCount",
      params: [account.address, "pending"]
    })
  });
  const nonceJson = await nonceRes.json();
  const nonce = parseInt(nonceJson.result, 16);
  console.log("Current nonce:", nonce);

  // Test sign dummy legacy tx
  const txRequest = {
    to: "0x5Df5315274652629aFf67FC2D78921c5096Fe3ee",
    value: 0n,
    gas: 200000n,
    gasPrice: 0n,
    nonce: nonce,
    chainId: 61999,
    type: "legacy",
    data: "0x"
  };

  const serialized = await account.signTransaction(txRequest);
  console.log("Serialized raw tx:", serialized.substring(0, 30) + "...");
}

testSign().catch(console.error);
