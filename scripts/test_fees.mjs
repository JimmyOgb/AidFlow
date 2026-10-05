import { createClient, chains, createAccount } from '../frontend/node_modules/genlayer-js/dist/index.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const keytar = require('C:/Users/NO GO NO/AppData/Roaming/npm/node_modules/genlayer/node_modules/keytar');

async function testWithFeeValue() {
  const pk = await keytar.getPassword('genlayer-cli', 'account:ace-deployer');
  const account = createAccount(pk);
  const client = createClient({ chain: chains.testnetBradbury, endpoint: 'https://rpc-bradbury.genlayer.com', account });

  const tinyCode = `import genlayer.py.gl as gl

class Tiny(gl.Contract):
    @gl.public.view
    def ping(self) -> str:
        return "pong"
`;

  console.log('Testing deployContract with explicit feeValue...');
  try {
    const tx = await client.deployContract({
      code: tinyCode,
      args: [],
      fees: {
        feeValue: 1000000000000000n, // 0.001 GEN
      }
    });
    console.log('Deployed! Tx:', tx);
    console.log('Waiting for receipt...');
    const receipt = await client.waitForFinalization({ hash: tx, interval: 3000, retries: 30 });
    console.log('Receipt:', receipt);
  } catch (err) {
    console.error('Deploy error:', err);
  }
}
testWithFeeValue();
