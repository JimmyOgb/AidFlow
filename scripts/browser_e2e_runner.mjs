import { spawn } from "child_process";
import http from "http";
import { createRequire } from "module";
import { createAccount } from "../frontend/node_modules/genlayer-js/dist/index.js";

const require = createRequire(import.meta.url);
const keytar = require("C:/Users/NO GO NO/AppData/Roaming/npm/node_modules/genlayer/node_modules/keytar");

const TARGET_URL = "https://aid-flow-gz8d.vercel.app/";
const STUDIONET_RPC = "https://studio.genlayer.com/api";
const CONTRACT_ADDRESS = "0x5Df5315274652629aFf67FC2D78921c5096Fe3ee";
const CHAIN_ID_INT = 61999;
const CHAIN_ID_HEX = "0xf22f";

// 1. Resolve Account
const privateKey = await keytar.getPassword("genlayer-cli", "account:ace-deployer");
if (!privateKey) throw new Error("Could not resolve account:ace-deployer private key from keychain");
const account = createAccount(privateKey);
console.log("================================================================================");
console.log(" AIDFLOW REAL BROWSER E2E TEST RUNNER");
console.log("================================================================================");
console.log("Target Frontend:   ", TARGET_URL);
console.log("Target Contract:   ", CONTRACT_ADDRESS);
console.log("Wallet Account:    ", account.address);
console.log("Network / Chain ID:", `StudioNet (${CHAIN_ID_INT} / ${CHAIN_ID_HEX})`);
console.log("================================================================================\n");

// Master log of transactions intercepted from the browser
const capturedBrowserTxs = [];

// 2. Start Local Wallet Bridge Server
let currentNonce = null;

async function syncNonce() {
  const res = await fetch(STUDIONET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "eth_getTransactionCount",
      params: [account.address, "pending"],
    }),
  });
  const data = await res.json();
  currentNonce = parseInt(data.result, 16);
  return currentNonce;
}

await syncNonce();
console.log(`[Wallet Bridge] Initialized nonce for ${account.address}: ${currentNonce}`);

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const { method, params } = JSON.parse(body);

      if (method === "eth_requestAccounts" || method === "eth_accounts") {
        console.log(`[Wallet Bridge] Handled ${method} -> returning [${account.address}]`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ result: [account.address] }));
        return;
      }

      if (method === "eth_chainId") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ result: CHAIN_ID_HEX }));
        return;
      }

      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") {
        console.log(`[Wallet Bridge] Handled ${method} -> OK`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ result: null }));
        return;
      }

      if (method === "eth_sendTransaction") {
        const txReq = params[0];
        console.log("\n" + "#".repeat(80));
        console.log(" [WALLET BRIDGE] REAL eth_sendTransaction RECEIVED FROM FRONTEND GenLayerJS!");
        console.log(" From:     ", txReq.from);
        console.log(" To:       ", txReq.to);
        console.log(" Value:    ", txReq.value || "0x0");
        console.log(" Gas:      ", txReq.gas);
        console.log(" Data Size:", txReq.data ? txReq.data.length : 0, "bytes");
        console.log(" Nonce Req:", txReq.nonce);
        console.log("#".repeat(80) + "\n");

        await syncNonce();
        const nonceToUse = currentNonce;
        currentNonce++;

        const legacyTx = {
          to: txReq.to,
          value: txReq.value ? BigInt(txReq.value) : 0n,
          gas: txReq.gas ? BigInt(txReq.gas) : 200000n,
          gasPrice: 0n,
          nonce: nonceToUse,
          chainId: CHAIN_ID_INT,
          type: "legacy",
          data: txReq.data || "0x",
        };

        console.log(`[Wallet Bridge] Signing transaction with nonce ${nonceToUse}...`);
        const serialized = await account.signTransaction(legacyTx);

        console.log(`[Wallet Bridge] Submitting eth_sendRawTransaction to StudioNet RPC...`);
        const rpcRes = await fetch(STUDIONET_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method: "eth_sendRawTransaction",
            params: [serialized],
          }),
        });
        const rpcJson = await rpcRes.json();
        console.log("[Wallet Bridge] StudioNet RPC Response:", JSON.stringify(rpcJson));

        if (rpcJson.error) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: rpcJson.error }));
          return;
        }

        const txHash = rpcJson.result;
        capturedBrowserTxs.push({
          method: "create_campaign",
          from: txReq.from,
          to: txReq.to,
          dataLength: txReq.data?.length,
          txHash,
          timestamp: Date.now(),
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ result: txHash }));
        return;
      }

      // Forward any other query to StudioNet RPC
      const fwd = await fetch(STUDIONET_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method,
          params,
        }),
      });
      const fwdJson = await fwd.json();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(fwdJson));
    } catch (err) {
      console.error("[Wallet Bridge Error]:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: err.message } }));
    }
  });
});

await new Promise((resolve) => server.listen(4567, "127.0.0.1", resolve));
console.log("[Wallet Bridge] Server listening on http://127.0.0.1:4567\n");

// 3. Launch Chrome with CDP
console.log("Launching Headless Chrome instance...");
const chrome = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
  "--headless=new",
  "--remote-debugging-port=9222",
  "--disable-gpu",
  "--no-sandbox",
  "--ignore-certificate-errors",
  "--disable-web-security",
  "--user-data-dir=C:\\Users\\NO GO NO\\AidFlow\\.chrome-e2e-profile",
]);

await new Promise((r) => setTimeout(r, 2500));

// Connect to CDP
const cdpVersionRes = await fetch("http://127.0.0.1:9222/json/version");
const cdpVersion = await cdpVersionRes.json();
console.log("Connected to Chrome:", cdpVersion.Browser);

// Create new target/tab
const newTabRes = await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" });
const tabInfo = await newTabRes.json();

const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);

let cdpId = 1;
const pendingCallbacks = new Map();

function sendCDP(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = cdpId++;
    pendingCallbacks.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pendingCallbacks.has(msg.id)) {
    const { resolve, reject } = pendingCallbacks.get(msg.id);
    pendingCallbacks.delete(msg.id);
    if (msg.error) reject(msg.error);
    else resolve(msg.result);
  } else if (msg.method === "Console.messageAdded") {
    const text = msg.params.message.text;
    console.log(`  [Browser Console] ${text}`);
  } else if (msg.method === "Runtime.consoleAPICalled") {
    const args = (msg.params.args || []).map((a) => a.value || a.description || JSON.stringify(a)).join(" ");
    console.log(`  [Browser Log] ${args}`);
  }
};

await new Promise((resolve) => ws.onopen = resolve);
console.log("WebSocket CDP connection opened.\n");

// Enable domains
await sendCDP("Page.enable");
await sendCDP("DOM.enable");
await sendCDP("Runtime.enable");
await sendCDP("Console.enable");
await sendCDP("Network.enable");

// 4. Inject EIP-1193 window.ethereum provider
console.log("Configuring Page.addScriptToEvaluateOnNewDocument with real EIP-1193 provider...");
const injectionScript = `
(() => {
  console.log("[INJECTED WALLET] Initializing window.ethereum connected to bridge on 127.0.0.1:4567...");
  const listeners = {};
  window.ethereum = {
    isMetaMask: true,
    chainId: "${CHAIN_ID_HEX}",
    networkVersion: "${CHAIN_ID_INT}",
    selectedAddress: "${account.address.toLowerCase()}",
    request: async ({ method, params = [] }) => {
      console.log("[INJECTED WALLET request]", method, params);
      try {
        const res = await fetch("http://127.0.0.1:4567/rpc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method, params })
        });
        const data = await res.json();
        if (data.error) {
          console.error("[INJECTED WALLET error]", method, data.error);
          throw new Error(data.error.message || JSON.stringify(data.error));
        }
        return data.result;
      } catch (err) {
        console.error("[INJECTED WALLET fetch error]", err);
        throw err;
      }
    },
    on: (evt, fn) => {
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(fn);
    },
    removeListener: (evt, fn) => {
      if (!listeners[evt]) return;
      listeners[evt] = listeners[evt].filter(f => f !== fn);
    }
  };
  window.dispatchEvent(new Event("ethereum#initialized"));
})();
`;

await sendCDP("Page.addScriptToEvaluateOnNewDocument", { source: injectionScript });

async function evalBrowser(expression) {
  const res = await sendCDP("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description || "Evaluation failed");
  }
  return res.result?.value;
}

// 5. Navigate to Home Page
console.log(`\nNavigating browser to: ${TARGET_URL}`);
await sendCDP("Page.navigate", { url: TARGET_URL });
await new Promise((r) => setTimeout(r, 4000));

const homeTitle = await evalBrowser("document.title");
const homeHeading = await evalBrowser("document.querySelector('h1')?.innerText");
const targetContractOnPage = await evalBrowser("document.body.innerText.includes('0x5Df5315274652629aFf67FC2D78921c5096Fe3ee')");
const chainIdOnPage = await evalBrowser("document.body.innerText.includes('61999')");

console.log("  Page Title:          ", homeTitle);
console.log("  Main Heading:        ", homeHeading);
console.log("  Displays 0xb727...:  ", targetContractOnPage);
console.log("  Displays Chain 61999:", chainIdOnPage);

// 6. Navigate to Explorer Page
console.log(`\nNavigating to Explorer: ${TARGET_URL}explorer`);
await sendCDP("Page.navigate", { url: TARGET_URL + "explorer" });
await new Promise((r) => setTimeout(r, 4000));

const explorerText = await evalBrowser("document.body.innerText");
const hasCampaignCount = explorerText.includes("Campaign Explorer");
console.log("  Explorer Page Loaded:    ", hasCampaignCount);
console.log("  Explorer Content Snippet:", explorerText.slice(0, 200).replace(/\n/g, " "));

// 7. Navigate to Create Campaign Page
console.log(`\nNavigating to Create Campaign Page: ${TARGET_URL}create`);
await sendCDP("Page.navigate", { url: TARGET_URL + "create" });
await new Promise((r) => setTimeout(r, 4000));

const createTitle = await evalBrowser("document.querySelector('h1')?.innerText");
console.log("  Create Page Heading:", createTitle);

// Fill in Form Fields via native keyboard typing into specific elements
console.log("\nFilling in Humanitarian Campaign Details with Real Keystrokes...");
const formFields = [
  { selector: 'input[placeholder*="title"]', text: `Urgent Medical Corridor ${Date.now()}` },
  { selector: 'textarea[placeholder*="Describe"]', text: "Immediate trauma supply shipment for emergency clinic." },
  { selector: 'input[placeholder*="0x..."]', text: account.address },
  { selector: 'input[placeholder*="Procure"]', text: "Procure 50 surgical trauma kits" },
  { selector: 'input[placeholder*="GEN amount"]', text: "1.0" },
  { selector: 'input[placeholder*="YYYY-MM-DD"]', text: "2026-12-31" },
  { selector: 'input[placeholder*="Required evidence"]', text: "Supplier invoice and signed hospital intake receipt" },
];

for (const field of formFields) {
  console.log(`  Typing into ${field.selector}...`);
  await evalBrowser(`
    (() => {
      const el = document.querySelector(${JSON.stringify(field.selector)});
      if (el) {
        el.focus();
        el.value = '';
      }
    })()
  `);
  await sendCDP("Input.insertText", { text: field.text });
  await new Promise((r) => setTimeout(r, 150));
}

// Click Review & Deploy Campaign to StudioNet button
console.log("\nClicking 'Review & Deploy Campaign to StudioNet' button...");
const clickReviewRes = await evalBrowser(`
  (() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const reviewBtn = btns.find(b => b.innerText.includes("REVIEW & DEPLOY") || b.innerText.includes("Review & Deploy"));
    if (reviewBtn) {
      reviewBtn.click();
      return { found: true, text: reviewBtn.innerText };
    }
    return { found: false };
  })()
`);
console.log("  Review Button Click:", clickReviewRes);

await new Promise((r) => setTimeout(r, 2000));

// Verify Confirmation Panel appears
const confirmPanelCheck = await evalBrowser(`
  (() => {
    const text = document.body.innerText;
    const authBtn = Array.from(document.querySelectorAll('button')).find(b =>
      b.innerText.includes("Authorize Intelligent Contract Call")
    );
    return {
      hasPanel: text.includes("GENLAYER TRANSACTION VERIFICATION PANEL"),
      hasAuthBtn: !!authBtn,
      authBtnText: authBtn ? authBtn.innerText : null,
      methodName: text.includes("create_campaign") ? "create_campaign" : "unknown",
      contractAddress: text.includes("0x5Df5315274652629aFf67FC2D78921c5096Fe3ee") ? "0x5Df5315274652629aFf67FC2D78921c5096Fe3ee" : "unknown",
    };
  })()
`);
console.log("  Verification Panel Detected:", confirmPanelCheck);

if (!confirmPanelCheck.hasAuthBtn) {
  throw new Error("Transaction verification panel or Authorize button did not appear!");
}

// Click "Authorize Intelligent Contract Call"
console.log("\nClicking 'Authorize Intelligent Contract Call' to trigger real Frontend -> GenLayerJS writeContract call...");
const clickAuthRes = await evalBrowser(`
  (() => {
    const authBtn = Array.from(document.querySelectorAll('button')).find(b =>
      b.innerText.includes("Authorize Intelligent Contract Call")
    );
    if (authBtn) {
      authBtn.click();
      return true;
    }
    return false;
  })()
`);
console.log("  Authorize Button Clicked:", clickAuthRes);

// Monitor UI state changes, GenLayerJS execution, and consensus lifecycle
console.log("\nMonitoring Frontend UI State, GenLayerJS execution, and consensus lifecycle...");
let finalUiTxState = "IDLE";
let finalUiStatusMsg = "";

for (let i = 0; i < 45; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const uiState = await evalBrowser(`
    (() => {
      const text = document.body.innerText;
      let stateMatch = text.match(/Transaction State:\\s*([A-Z_]+)/i) ||
                       text.match(/Consensus:\\s*([A-Z_]+)/i) ||
                       text.match(/Status:\\s*([A-Z_]+)/i);
      let detectedState = stateMatch ? stateMatch[1] : "UNKNOWN";
      return {
        detectedState,
        fullText: text.slice(text.indexOf("GENLAYER TRANSACTION VERIFICATION PANEL"), text.indexOf("GENLAYER TRANSACTION VERIFICATION PANEL") + 800).replace(/\\n/g, " ")
      };
    })()
  `);

  if (uiState && uiState.detectedState !== "UNKNOWN") {
    finalUiTxState = uiState.detectedState;
    console.log(`  [T+${(i + 1) * 2}s] UI State: ${finalUiTxState}`);
    if (finalUiTxState === "SUCCESS" || finalUiTxState === "UNDETERMINED" || finalUiTxState === "FAILED") {
      break;
    }
  }
}

console.log("\n" + "=".repeat(80));
console.log(" FRONTEND E2E TEST RESULTS FROM REAL DEPLOYED BROWSER");
console.log("=".repeat(80));
console.log("Final Frontend Transaction State:", finalUiTxState);
console.log("Captured Browser Txs Count:      ", capturedBrowserTxs.length);

if (capturedBrowserTxs.length > 0) {
  const tx = capturedBrowserTxs[0];
  console.log("  Contract Method Invoked:        ", tx.method);
  console.log("  Recipient Address (Target):     ", tx.to);
  console.log("  Transaction Data Length:        ", tx.dataLength, "chars");
  console.log("  GenLayer Transaction ID:        ", tx.txHash);

  // Read the transaction from StudioNet RPC
  console.log("\nFetching authoritative transaction receipt from StudioNet RPC...");
  const receiptRes = await fetch(STUDIONET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "eth_getTransactionReceipt",
      params: [tx.txHash],
    }),
  });
  const receiptJson = await receiptRes.json();
  const r = receiptJson.result;
  if (r) {
    console.log("  Receipt Status:       ", r.status, `(${r.status_name})`);
    console.log("  Consensus Result Name:", r.result_name);
    console.log("  Execution Result:     ", r.tx_execution_result_name);
    console.log("  Round Validators:     ", JSON.stringify(r.last_round?.round_validators || []));
    console.log("  Votes Committed:      ", r.last_round?.votes_committed);
    console.log("  Votes Revealed:       ", r.last_round?.votes_revealed);
  } else {
    console.log("  Receipt not yet available or null");
  }
}

console.log("=".repeat(80) + "\n");

// Clean up
try {
  ws.close();
  chrome.kill();
  server.close();
} catch {}
process.exit(0);
