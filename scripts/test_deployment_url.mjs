async function check() {
  const target = process.argv[2] || "https://aid-flow-gz8d.vercel.app/";
  console.log("Checking target:", target);
  const res = await fetch(target);
  console.log("Status:", res.status, res.statusText);
  const html = await res.text();
  console.log("HTML length:", html.length);
  
  const scriptRegex = /src="(\/_next\/static\/chunks\/[^"]+\.js)"/g;
  const chunkPaths = new Set();
  let m;
  while ((m = scriptRegex.exec(html)) !== null) {
    chunkPaths.add(m[1]);
  }

  for (const page of ["/create", "/explorer"]) {
    const pageRes = await fetch(target.replace(/\/$/, "") + page);
    console.log(`${page} Status:`, pageRes.status, pageRes.statusText);
    const pageHtml = await pageRes.text();
    while ((m = scriptRegex.exec(pageHtml)) !== null) {
      chunkPaths.add(m[1]);
    }
  }

  console.log(`Inspecting ${chunkPaths.size} chunks on ${target}...`);
  for (const chunk of chunkPaths) {
    const chunkUrl = target.replace(/\/$/, "") + chunk;
    const cRes = await fetch(chunkUrl);
    const code = await cRes.text();
    const hasContract = code.toLowerCase().includes("0x5df5315274652629aff67fc2d78921c5096fe3ee");
    const hasStale = code.toLowerCase().includes("0xb7ddb3322403f15ba9648c96e2b60cb391d53ae3");
    const hasWriteContract = code.includes("writeContract");
    const hasWaitForDecision = code.includes("waitForDecision");
    const hasWaitForFinalization = code.includes("waitForFinalization");
    const hasIsSuccessful = code.includes("isSuccessful");
    const hasChainId = code.includes("61999");
    if (hasContract || hasStale || hasWriteContract) {
      console.log(`Chunk ${chunk}: hasContract=${hasContract}, hasStale=${hasStale}, hasWriteContract=${hasWriteContract}, hasDecision=${hasWaitForDecision}, hasFinalization=${hasWaitForFinalization}, hasIsSuccessful=${hasIsSuccessful}, hasChainId=${hasChainId}`);
    }
  }
}
check().catch(console.error);
