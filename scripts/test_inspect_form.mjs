import { spawn } from "child_process";

async function testInspectForm() {
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

  const formDetails = await send("Runtime.evaluate", {
    expression: `
      (() => {
        const inputs = Array.from(document.querySelectorAll('input')).map((el, i) => ({
          i,
          type: el.type,
          placeholder: el.placeholder,
          value: el.value,
          required: el.required
        }));
        const textareas = Array.from(document.querySelectorAll('textarea')).map((el, i) => ({
          i,
          placeholder: el.placeholder,
          value: el.value,
          required: el.required
        }));
        const btns = Array.from(document.querySelectorAll('button')).map((el, i) => ({
          i,
          type: el.type,
          text: el.innerText
        }));
        return { inputs, textareas, btns };
      })()
    `,
    returnByValue: true
  });

  console.log("Form details:", JSON.stringify(formDetails.result.value, null, 2));

  ws.close();
  chrome.kill();
}

testInspectForm().catch(console.error);
