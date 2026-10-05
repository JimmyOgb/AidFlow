import { createClient, chains, createAccount } from '../frontend/node_modules/genlayer-js/dist/index.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const keytar = require('C:/Users/NO GO NO/AppData/Roaming/npm/node_modules/genlayer/node_modules/keytar');

async function probe() {
  const privateKey = await keytar.getPassword('genlayer-cli', 'account:ace-deployer');
  const account = createAccount(privateKey);
  const client = createClient({
    chain: chains.studionet,
    endpoint: 'https://studio.genlayer.com/api',
    account,
  });

  const contractAddress = '0x5Df5315274652629aFf67FC2D78921c5096Fe3ee';
  console.log('Probing StudioNet consensus on contract:', contractAddress);
  console.log('Account:', account.address);

  // Check balance
  const bal = await client.getBalance({ address: account.address });
  console.log('Wallet Balance:', bal.toString(), 'wei (', Number(bal) / 1e18, 'GEN )');

  // Submit create_campaign
  console.log('Submitting create_campaign writeContract call...');
  const txHash = await client.writeContract({
    address: contractAddress,
    functionName: 'create_campaign',
    args: [
      account.address,
      'Probing StudioNet Consensus ' + Date.now(),
      'Probe transaction to test consensus committee availability',
      [BigInt(1000000000000000000n)],
      ['Procure aid supplies'],
      ['2026-12-31'],
      ['Receipt of purchase']
    ],
    value: 0n,
  });

  console.log('Submitted! Transaction Hash / ID:', txHash);

  console.log('Waiting for decision / finalization (retries: 30, interval: 2000)...');
  let receipt = null;
  try {
    receipt = await client.waitForFinalization({
      hash: txHash,
      interval: 2000,
      retries: 30,
    });
  } catch (err) {
    console.log('waitForFinalization note:', err.message);
    receipt = await client.getTransaction({ hash: txHash });
  }

  console.log('\n authoritatively resolved receipt:');
  console.log('  Status:', receipt?.status, `(${receipt?.statusName})`);
  console.log('  Result:', receipt?.result, `(${receipt?.result_name || receipt?.resultName})`);
  console.log('  Execution Result:', receipt?.txExecutionResultName || receipt?.tx_execution_result_name);
  console.log('  Round Validators:', JSON.stringify(receipt?.last_round?.round_validators || []));
  console.log('  Votes Committed:', receipt?.last_round?.votes_committed);
  console.log('  Votes Revealed:', receipt?.last_round?.votes_revealed);
  console.log('  Outcome:', receipt?.lifecycle?.outcome);
  console.log('  Raw Receipt:', JSON.stringify(receipt, null, 2));
}

probe().catch(e => console.error('Probe failed:', e));
