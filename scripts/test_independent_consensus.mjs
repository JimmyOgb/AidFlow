import { createClient, chains, createAccount } from '../frontend/node_modules/genlayer-js/dist/index.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const keytar = require('C:/Users/NO GO NO/AppData/Roaming/npm/node_modules/genlayer/node_modules/keytar');

async function testIndependent() {
  const pk = await keytar.getPassword('genlayer-cli', 'account:ace-deployer');
  const account = createAccount(pk);
  const client = createClient({ chain: chains.studionet, endpoint: 'https://studio.genlayer.com/api', account });

  const minimalCode = `import genlayer.py.gl as gl

class SimpleCounter(gl.Contract):
    count: int

    def __init__(self):
        self.count = 0

    @gl.public.write
    def increment(self) -> int:
        self.count += 1
        return self.count

    @gl.public.view
    def get_count(self) -> int:
        return self.count
`;

  console.log('================================================================================');
  console.log(' INDEPENDENT NON-AIDFLOW CONTRACT DEPLOYMENT PROBE ON STUDIONET');
  console.log('================================================================================');
  console.log('Signer Account:', account.address);
  console.log('Network:       StudioNet (61999) - https://studio.genlayer.com/api');

  console.log('\nSubmitting independent contract deployment to StudioNet...');
  try {
    const txHash = await client.deployContract({
      code: minimalCode,
      args: [],
    });
    console.log('Transaction Submitted! Hash:', txHash);
    console.log('Waiting for finalization...');
    let receipt = null;
    try {
      receipt = await client.waitForFinalization({ hash: txHash, interval: 2000, retries: 30 });
    } catch (err) {
      console.log('waitForFinalization note:', err.message);
      receipt = await client.getTransaction({ hash: txHash });
    }

    console.log('\nIndependent Deployment Transaction Authoritative Receipt:');
    console.log('  Transaction ID:   ', receipt?.hash);
    console.log('  Status:           ', receipt?.status, `(${receipt?.statusName || receipt?.status_name})`);
    console.log('  Result:           ', receipt?.result, `(${receipt?.result_name || receipt?.resultName})`);
    console.log('  Execution Result: ', receipt?.txExecutionResultName || receipt?.tx_execution_result_name);
    console.log('  Round Validators: ', JSON.stringify(receipt?.last_round?.round_validators || []));
    console.log('  Votes Committed:  ', receipt?.last_round?.votes_committed);
    console.log('  Votes Revealed:   ', receipt?.last_round?.votes_revealed);
    console.log('  Lifecycle Outcome:', receipt?.lifecycle?.outcome);
    console.log('================================================================================\n');
  } catch (e) {
    console.error('Independent deployment error:', e);
  }
}

testIndependent().catch(console.error);
