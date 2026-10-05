# AidFlow Steward Review Summary: Revision `cf79b369` / `cf79b36e`

## What Changed Since the Rejected Revision (`f8f509d9`)

1. **EOA Transfer Implementation Fixed**:
   - In `f8f509d9`, `claim_payout` and `claim_refund` invoked `gl.get_contract_at(sender).emit_transfer(value=amount)`. This was rejected because user wallets are EVM EOAs, not GenLayer contracts.
   - In `cf79b36e`, the contract defines `@gl.evm.contract_interface class _WalletRecipient` and calls `_WalletRecipient(sender).emit_transfer(value=amount)`. This correctly triggers native value transfers to EOA accounts.
2. **Redeployment to StudioNet**:
   - Deployed new contract with the EOA transfer interface: [`0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575`](https://studio.genlayer.com/?import-contract=0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575).
   - Deployment transaction: `0x16c6ce336301ee3b1e9fd822289300d49cb57a2bae9ea94931bbc529c0641ea2`.
3. **Comprehensive Direct VM Escrow Accounting Tests**:
   - Added `test_real_escrow_accounting_payout_and_refund` in `tests/direct/test_aidflow.py`.
   - Verifies organization EOA balance increases after `claim_payout`, contributor EOA balance increases after `claim_refund`, contract balance reduces to exact 0, double-claims revert, and unauthorized accounts cannot claim.
   - 20/20 direct VM tests pass.
4. **Production Frontend Sync**:
   - Vercel production frontend updated to target `0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575` with 0 stale address references.

---

## What Is Now Proven

### 1. Contract-Level Proof (Direct VM)
- **EOA Transfer Interface**: Verified that `_WalletRecipient(sender).emit_transfer(value=amount)` executes native value transfers from contract balance to user EOAs.
- **Checks-Effects-Interactions Invariant**: Claimable balances are zeroed *before* the external transfer, preventing reentrancy or duplicate claims.
- **Access Control**: Unauthorized addresses attempting `claim_payout()` or `claim_refund()` revert with descriptive errors without altering balances.
- **Multi-Contributor Escrow Solvency**: Exact mathematical distribution of unreleased escrow among multiple contributors, with rounding remainder allocated to the final contributor to maintain total balance conservation.

### 2. Frontend Proof
- **Real GenLayerJS Write Pipeline**: The frontend creates writes through `createClient` and `client.writeContract` with an EIP-1193 Web3 provider.
- **No Mock Fallbacks**: Zero mock campaigns, zero synthetic balances, zero fake validator results exist.
- **Consensus-Aware State Machine**: The frontend tracks transactions through `AWAITING_WALLET` → `PROCESSING` → `CONSENSUS` → `FINALIZED` and correctly identifies `UNDETERMINED` / `NO_MAJORITY`.

### 3. Deployment Proof
- The live production bundles on Vercel (`https://aid-flow1.vercel.app/` and `https://aid-flow-2ahq.vercel.app/`) reference contract `0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575`.
- Verified by automated bundle inspection script `scripts/verify_production_deployment.mjs`.

### 4. Live StudioNet Proof
- Real browser E2E test using Chrome DevTools Protocol (CDP) connected an EOA wallet (`0xE4220c4b71877bb94EB173f467ef5c5557017085`), populated the campaign creation form, and triggered `create_campaign`.
- The frontend issued a genuine 2,250-byte transaction signed by the wallet and submitted to StudioNet RPC.
- Transaction ID: `0x9f3535d2c5274b1df595038c64589b61cd7a90b1036907f7a07af7c514f51743`.

---

## What Remains Unproven (and Why)

- **Complete Live StudioNet Escrow Settlement**:
  We cannot demonstrate a completed live campaign creation, live funding, live adjudication, live payout, or live refund on the public StudioNet network at this time.
- **Reason**: Live StudioNet consensus currently returns `NO_MAJORITY` on transaction execution.

---

## Infrastructure Blocker: StudioNet Validator Availability

When transaction `0x9f3535d2c5274b1df595038c64589b61cd7a90b1036907f7a07af7c514f51743` was submitted to StudioNet, RPC returned:
- `status`: `7` (`FINALIZED`)
- `result`: `5` (`NO_MAJORITY`)
- `round_validators`: `[]` (empty validator set)
- `votes_committed`: `0`
- `lifecycle.outcome`: `"undetermined"`

Because the validator pool assigned 0 validators to the transaction round, no consensus majority could be formed, and the campaign was not saved on-chain.

**Crucially, AidFlow did not fake this outcome.** The frontend accurately displayed `UNDETERMINED`, halted the lifecycle, and did not inject synthetic state.

---

## Independent Reproduction Steps for Stewards

### 1. Verify Contract Implementation
Inspect lines 135–142 and lines 705–732 in `contracts/aidflow.py`:
- Notice the `@gl.evm.contract_interface class _WalletRecipient` definition.
- Notice `_WalletRecipient(sender).emit_transfer(value=amount)` in `claim_payout` and `claim_refund`.

### 2. Run the Direct VM Test Suite
```bash
pytest tests/direct/ -v
```
All 20 tests should pass, including `test_real_escrow_accounting_payout_and_refund`.

### 3. Verify the Production Frontend Deployment
```bash
node scripts/verify_production_deployment.mjs
```
Confirms the live frontend bundle contains `0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575` and zero stale references.

### 4. Verify Live StudioNet Consensus State
Query the StudioNet RPC for the transaction generated during our live browser test:
```bash
node -e "
import { createClient, chains } from './frontend/node_modules/genlayer-js/dist/index.js';
const client = createClient({ chain: chains.studionet, endpoint: 'https://studio.genlayer.com/api' });
const tx = await client.getTransaction({ hash: '0x9f3535d2c5274b1df595038c64589b61cd7a90b1036907f7a07af7c514f51743' });
console.log({
  hash: tx.hash,
  status: tx.statusName,
  result: tx.result_name,
  validators: tx.last_round.round_validators,
  outcome: tx.lifecycle.outcome
});
"
```
Output confirms: `status: 'FINALIZED'`, `result: 'NO_MAJORITY'`, `validators: []`, `outcome: 'undetermined'`.
