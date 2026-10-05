import { spawn } from "child_process";

async function testSubmit() {
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

  // Focus and type into each field natively
  const inputs = [
    { selector: 'input[placeholder*="title"]', text: "Emergency Aid Corridor" },
    { selector: 'textarea[placeholder*="Describe"]', text: "Essential emergency supplies for displaced population." },
    { selector: 'input[placeholder*="0x..."]', text: "0xE4220c4b71877bb94EB173f467ef5c5557017085" },
    { selector: 'input[placeholder*="Procure"]', text: "Procure 50 surgical trauma kits" },
    { selector: 'input[placeholder*="GEN amount"]', text: "1.0" },
    { selector: 'input[placeholder*="YYYY-MM-DD"]', text: "2026-12-31" },
    { selector: 'input[placeholder*="Required evidence"]', text: "Supplier invoice and signed receipt" },
  ];

  for (const item of inputs) {
    console.log(`Typing into ${item.selector}...`);
    await send("Runtime.evaluate", {
      expression: `
        (() => {
          const el = document.querySelector(${JSON.stringify(item.selector)});
          if (el) {
            el.focus();
            el.value = '';
          }
        })()
      `
    });
    await send("Input.insertText", { text: item.text });
    await new Promise((r) => setTimeout(r, 200));
  }

  // Click submit button (the review button)
  console.log("Clicking Review & Deploy button...");
  const clickRes = await send("Runtime.evaluate", {
    expression: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const reviewBtn = btns.find(b => b.innerText.includes("REVIEW & DEPLOY") || b.innerText.includes("Review & Deploy"));
        if (reviewBtn) {
          reviewBtn.click();
          return { found: true, text: reviewBtn.innerText };
        }
        return { found: false };
      })()
    `,
    returnByValue: true
  });
  console.log("Review button click:", clickRes.result.value);

  await new Promise((r) => setTimeout(r, 2000));

  // Check state after click
  const stateRes = await send("Runtime.evaluate", {
    expression: `
      (() => {
        const text = document.body.innerText;
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes("Confirm & Sign"));
        return {
          hasConfirmBtn: !!confirmBtn,
          bodySnippet: text.slice(text.indexOf("Milestone Tranches"), text.indexOf("Milestone Tranches") + 600).replace(/\\n/g, " ")
        };
      })()
    `,
    returnByValue: true
  });
  console.log("Post-click state:", JSON.stringify(stateRes.result.value, null, 2));

  ws.close();
  chrome.kill();
}

testSubmit().catch(console.error);
