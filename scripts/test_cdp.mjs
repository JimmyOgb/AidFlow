import { spawn } from "child_process";

async function testChromeCDP() {
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=9222",
    "--disable-gpu",
    "--no-sandbox",
    "--user-data-dir=C:\\Users\\NO GO NO\\AidFlow\\.chrome-test-profile"
  ]);

  console.log("Chrome spawned, waiting for debugging port...");
  await new Promise((r) => setTimeout(r, 2000));

  try {
    const res = await fetch("http://127.0.0.1:9222/json/version");
    const json = await res.json();
    console.log("CDP Connected successfully:", json.Browser);
    console.log("WebSocket URL:", json.webSocketDebuggerUrl);
  } catch (err) {
    console.error("Failed connecting to Chrome CDP:", err.message);
  } finally {
    chrome.kill();
  }
}

testChromeCDP();
