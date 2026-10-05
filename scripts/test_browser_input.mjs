import { spawn } from "child_process";

async function testCDPInput() {
  const chrome = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
    "--headless=new",
    "--remote-debugging-port=9222",
    "--disable-gpu",
    "--no-sandbox",
    "--user-data-dir=C:\\Users\\NO GO NO\\AidFlow\\.chrome-e2e-profile",
  ]);

  await new Promise((r) => setTimeout(r, 2000));
  const newTabRes = await fetch("http://127.0.0.1:9222/json/new?https://aid-flow-2ahq.vercel.app/create", { method: "PUT" });
  const tabInfo = await newTabRes.json();
  const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);

  let cdpId = 1;
  const pending = new Map();
  function send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = cdpId++;
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) rej(m.error);
      else res(m.result);
    }
  };

  await new Promise((r) => ws.onopen = r);
  await send("Page.enable");
  await send("DOM.enable");
  await send("Runtime.enable");

  await new Promise((r) => setTimeout(r, 4000));

  // Focus input 0 (Title) and type
  await send("Runtime.evaluate", { expression: "document.querySelectorAll('input')[0].focus()" });
  await send("Input.insertText", { text: "Medical Supply Relief Mission" });

  // Focus textarea 0 (Description) and type
  await send("Runtime.evaluate", { expression: "document.querySelectorAll('textarea')[0].focus()" });
  await send("Input.insertText", { text: "Critical aid for medical trauma support" });

  // Focus input 1 (Org address) and type
  await send("Runtime.evaluate", { expression: "document.querySelectorAll('input')[1].focus()" });
  await send("Input.insertText", { text: "0xE4220c4b71877bb94EB173f467ef5c5557017085" });

  // Focus input 2 (Target) and type
  await send("Runtime.evaluate", { expression: "document.querySelectorAll('input')[2].focus()" });
  await send("Input.insertText", { text: "Procure trauma kits" });

  // Focus input 3 (Amount) and type
  await send("Runtime.evaluate", { expression: "document.querySelectorAll('input')[3].focus()" });
  await send("Input.insertText", { text: "1.0" });

  // Focus input 4 (Deadline) and type
  await send("Runtime.evaluate", { expression: "document.querySelectorAll('input')[4].select()" });
  await send("Input.insertText", { text: "2026-12-31" });

  // Focus input 5 (Policy) and type
  await send("Runtime.evaluate", { expression: "document.querySelectorAll('input')[5].focus()" });
  await send("Input.insertText", { text: "Verified medical delivery receipts" });

  await new Promise((r) => setTimeout(r, 1000));

  // Click Review button
  const clickRes = await send("Runtime.evaluate", {
    expression: `
      (() => {
        const btn = document.querySelector('button[type="submit"]');
        if (btn) {
          btn.click();
          return "Clicked submit button!";
        }
        return "Button not found";
      })()
    `,
    returnByValue: true
  });
  console.log("Click result:", clickRes.result.value);

  await new Promise((r) => setTimeout(r, 2000));

  // Check if confirmation panel appeared
  const checkRes = await send("Runtime.evaluate", {
    expression: `
      (() => {
        const text = document.body.innerText;
        return {
          hasConfirmHeader: text.includes("Transaction Authorization") || text.includes("Review & Sign"),
          hasConfirmSignBtn: text.includes("Confirm & Sign"),
          hasCreateCampaign: text.includes("create_campaign"),
          snippet: text.slice(text.indexOf("Transaction") > -1 ? text.indexOf("Transaction") : 0, 400).replace(/\\n/g, " ")
        };
      })()
    `,
    returnByValue: true
  });
  console.log("Confirmation panel check:", JSON.stringify(checkRes.result.value, null, 2));

  ws.close();
  chrome.kill();
}

testCDPInput().catch(console.error);
