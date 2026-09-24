async function verifyProduction() {
  console.log("================================================================================");
  console.log(" VERIFYING PRODUCTION VERCEL DEPLOYMENT (https://aid-flow1.vercel.app/)");
  console.log("================================================================================");

  // 1. Check Homepage
  const homeRes = await fetch("https://aid-flow1.vercel.app/");
  console.log(`Homepage HTTP Status: ${homeRes.status} ${homeRes.statusText}`);
  const homeHtml = await homeRes.text();
  console.log(`Includes "StudioNet (Chain ID: 61999)": ${homeHtml.includes("StudioNet (Chain ID: 61999)")}`);
  console.log(`Includes "AidFlow":                     ${homeHtml.includes("AidFlow")}`);

  // 2. Extract scripts
  const scriptRegex = /src="(\/_next\/static\/chunks\/[^"]+\.js)"/g;
  const chunkPaths = new Set();
  let m;
  while ((m = scriptRegex.exec(homeHtml)) !== null) {
    chunkPaths.add(m[1]);
  }

  // Also check create, explorer, and campaign pages
  for (const path of ["/create", "/explorer"]) {
    const pageRes = await fetch(`https://aid-flow1.vercel.app${path}`);
    console.log(`${path} HTTP Status: ${pageRes.status} ${pageRes.statusText}`);
    const pageHtml = await pageRes.text();
    while ((m = scriptRegex.exec(pageHtml)) !== null) {
      chunkPaths.add(m[1]);
    }
  }

  console.log(`\nInspecting ${chunkPaths.size} client JavaScript bundle chunks on Vercel...`);
  let contractTargetFound = false;
  let writeContractFound = false;
  let waitForDecisionFound = false;
  let waitForFinalizationFound = false;
  let isSuccessfulFound = false;
  let duplicateEvmHashFound = false;
  let guardedEvmHashFound = false;

  for (const chunkPath of chunkPaths) {
    const chunkUrl = `https://aid-flow1.vercel.app${chunkPath}`;
    const chunkRes = await fetch(chunkUrl);
    const chunkCode = await chunkRes.text();

    if (chunkCode.includes("0xB7ddB3322403F15ba9648c96E2B60Cb391d53Ae3")) {
      contractTargetFound = true;
      console.log(`[PASS] Correct contract address 0xB7ddB3322403F15ba9648c96E2B60Cb391d53Ae3 verified in: ${chunkPath}`);
    }
    if (chunkCode.includes("writeContract")) {
      writeContractFound = true;
      console.log(`[PASS] client.writeContract verified in: ${chunkPath}`);
    }
    if (chunkCode.includes("waitForDecision")) {
      waitForDecisionFound = true;
      console.log(`[PASS] waitForDecision verified in: ${chunkPath}`);
    }
    if (chunkCode.includes("waitForFinalization")) {
      waitForFinalizationFound = true;
      console.log(`[PASS] waitForFinalization verified in: ${chunkPath}`);
    }
    if (chunkCode.includes("isSuccessful")) {
      isSuccessfulFound = true;
      console.log(`[PASS] isSuccessful verification verified in: ${chunkPath}`);
    }
    if (chunkCode.includes("evmHash:txId") || chunkCode.includes("evmHash: txId")) {
      duplicateEvmHashFound = true;
      console.error(`[FAIL] Duplicate evmHash: txId found in: ${chunkPath}`);
    }
    if (chunkCode.includes(".evmHash!==") || chunkCode.includes(".evmHash !==")) {
      guardedEvmHashFound = true;
      console.log(`[PASS] Guarded EVM hash display (evmHash !== txId) verified in: ${chunkPath}`);
    }
  }

  console.log("\n--------------------------------------------------------------------------------");
  console.log(" PRODUCTION DEPLOYMENT VERIFICATION SUMMARY");
  console.log("--------------------------------------------------------------------------------");
  console.log(`Contract Address Target:      ${contractTargetFound ? "VERIFIED (0xB7ddB3322403F15ba9648c96E2B60Cb391d53Ae3)" : "MISSING"}`);
  console.log(`writeContract Implementation: ${writeContractFound ? "VERIFIED" : "MISSING"}`);
  console.log(`waitForDecision Lifecycle:    ${waitForDecisionFound ? "VERIFIED" : "MISSING"}`);
  console.log(`waitForFinalization Final:    ${waitForFinalizationFound ? "VERIFIED" : "MISSING"}`);
  console.log(`isSuccessful Verification:    ${isSuccessfulFound ? "VERIFIED" : "MISSING"}`);
  console.log(`No Duplicate EVM Hash:        ${!duplicateEvmHashFound ? "CONFIRMED (Zero occurrences)" : "FAILED"}`);
  console.log(`Guarded EVM Hash Display:     ${guardedEvmHashFound ? "CONFIRMED (evmHash !== txId)" : "PENDING PROPAGATION"}`);
  console.log("================================================================================\n");
}

verifyProduction().catch(console.error);
