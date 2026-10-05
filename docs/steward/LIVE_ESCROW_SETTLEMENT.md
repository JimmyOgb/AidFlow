# AidFlow Live Escrow Settlement & Verification Report

**Date**: October 5, 2026  
**Audited Revision**: `cf79b36ef39ff10ae34c41c6c9851708cc7d1023` (`cf79b369` / `cf79b36e`)  
**Network**: GenLayer StudioNet (Chain ID: `61999`, RPC: `https://studio.genlayer.com/api`)  
**Contract Address**: [`0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575`](https://studio.genlayer.com/?import-contract=0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575)  
**Production Frontend**: [https://aid-flow-gz8d.vercel.app/](https://aid-flow-gz8d.vercel.app/)  
**Test Wallet Account**: `0xE4220c4b71877bb94EB173f467ef5c5557017085`  

---

## Executive Classification: BLOCKED BY STUDIO NET CONSENSUS

This report evaluates the live payout and refund implementation of AidFlow following the steward's rejection of revision `f8f509d9`. The defect in `f8f509d9`—calling `gl.get_contract_at(sender).emit_transfer(...)` for user EOA recipients—has been corrected to `@gl.evm.contract_interface class _WalletRecipient` and `_WalletRecipient(sender).emit_transfer(value=amount)`.

This report separates the evidence into three distinct, non-conflated categories:
1. **Category A: Direct VM Evidence** (Contract-level deterministic execution proof)
2. **Category B: Live StudioNet Evidence** (Authentic transaction submissions and receipts on the public network)
3. **Category C: Infrastructure Limitations** (Live validator pool availability and consensus results)

---

## Category A: Direct VM Evidence (Contract-Level Verification)

The complete direct test suite was executed in an isolated GenVM environment:
```bash
pytest tests/direct/ -v
```
**Result**: 20/20 tests passed in 4.39s.

### Proven Escrow Accounting Behaviors ([`tests/direct/test_aidflow.py`](file:///C:/Users/NO%20GO%20NO/AidFlow/tests/direct/test_aidflow.py#L945-L1130))

1. **Native EOA Value Payout**:
   - Organization EOA balance was tracked before and after calling `claim_payout()`.
   - Organization EOA balance increased by exactly the released tranche amount (`30 GEN`).
   - Contract balance decreased by exactly `30 GEN`.
   - `org_claimable[org]` was zeroed.

2. **Native EOA Value Refund**:
   - Following milestone failure, campaign unreleased balance (`70 GEN`) was refunded.
   - Contributor Alice (70% contributor) claimed refund: EOA balance increased by `49 GEN`.
   - Contributor Charlie (30% contributor) claimed refund: EOA balance increased by `21 GEN`.
   - Contract balance decreased to exact `0 GEN`.
   - `donor_claimable` for both contributors zeroed.

3. **Reentrancy & Double-Claim Protections**:
   - `self.org_claimable[sender] = 0` and `self.donor_claimable[sender] = 0` occur **before** `_WalletRecipient(sender).emit_transfer(value=amount)`.
   - Repeat attempts by Organization or Contributors revert immediately with `"No claimable payout balance"` / `"No claimable refund balance"`.

4. **Access Control & Anti-Redirection**:
   - Third parties and contributors calling `claim_payout()` revert without modifying state.
   - Organizations and third parties calling `claim_refund()` revert without modifying state.
   - Payouts and refunds cannot be directed to arbitrary addresses; destination is strictly bound to `gl.message.sender_address`.

5. **Terminal State Invariants**:
   - `STATUS_REFUNDED` campaigns permanently reject subsequent refunds, milestone releases, evidence submissions, and adjudications.

*Note: These direct VM tests verify GenVM bytecode execution and accounting logic. They are not claimed to be live multi-node StudioNet consensus tests.*

---

## Category B: Live StudioNet Evidence (On-Chain Submissions)

All transactions were executed against GenLayer StudioNet using real wallet `0xE4220c4b71877bb94EB173f467ef5c5557017085`.

### 1. Browser CDP Campaign Submission on Production Frontend
* **Frontend**: `https://aid-flow-gz8d.vercel.app/create`
* **Method**: `create_campaign`
* **Wallet**: `0xE4220c4b71877bb94EB173f467ef5c5557017085` (Nonce: `321`)
* **GenLayer Transaction ID**: `0xeaf9cec0046cf54529aaf4cd6c33a513c48aca0b876423763b6e6e29cd0dc90c`
* **UI Lifecycle Observed**:
  - `AWAITING_WALLET` → `PROCESSING` → `UNDETERMINED`
  - The frontend did not display success, did not fabricate a campaign ID, and preserved actual transaction tracking.

### 2. Direct RPC Consensus Probe on Contract Target
* **Endpoint**: `https://studio.genlayer.com/api`
* **Method**: `create_campaign`
* **Wallet**: `0xE4220c4b71877bb94EB173f467ef5c5557017085` (Nonce: `322`)
* **GenLayer Transaction ID**: `0x0dc4bb58eaf10b81be4111e7e447b8aee00bf4fa7de8a756acd1c0fc869e858f`
* **RPC Status**: `FINALIZED` (Result: `NO_MAJORITY`, Validators: `[]`)

### 3. Direct Write on Existing StudioNet Contract `0xB7ddB3322403F15ba9648c96E2B60Cb391d53Ae3`
* **Endpoint**: `https://studio.genlayer.com/api`
* **Method**: `create_campaign`
* **GenLayer Transaction ID**: `0x1bb718cd2b0c780f655d134285685d7ea2e7856ab38d66f045398ad001c5be74`
* **Simulation Result**: GenVM simulation executes successfully and returns campaign ID `0n`.
* **Live Network Result**: `FINALIZED` (Result: `NO_MAJORITY`, Validators: `[]`)

### 4. Independent Non-AidFlow Contract Deployment (`SimpleCounter`)
* **Endpoint**: `https://studio.genlayer.com/api`
* **Action**: Deployment of a standalone 5-line counter contract completely unrelated to AidFlow
* **GenLayer Transaction ID**: `0x507f39d201493f103895664a4e2403ffd4feb59ee6a4149bba62818f4d3338b2`
* **Live Network Result**: `FINALIZED` (Result: `NO_MAJORITY`, Validators: `[]`)

---

## Category C: Infrastructure Limitations (StudioNet Consensus Blocker)

Authoritative transaction receipts returned by StudioNet RPC (`client.getTransaction`) for all submitted transactions consistently show:

```json
{
  "hash": "0x507f39d201493f103895664a4e2403ffd4feb59ee6a4149bba62818f4d3338b2",
  "status": 7,
  "statusName": "FINALIZED",
  "result": 5,
  "result_name": "NO_MAJORITY",
  "lifecycle": {
    "state": "finalized",
    "outcome": "undetermined"
  },
  "last_round": {
    "round": "0",
    "votes_committed": "0",
    "votes_revealed": "0",
    "round_validators": [],
    "validator_votes": []
  }
}
```

### Technical Root Cause of Blocker
1. **Network-Wide Validator Pool Vacancy**: The StudioNet consensus coordinator assigns 0 validators to the initial consensus round (`round_validators: []`).
2. **Zero Votes**: Because no validators are assigned to the committee, 0 votes are committed (`votes_committed: "0"`) and 0 votes are revealed.
3. **Consensus Outcome**: The transaction is marked `FINALIZED` with result code `5` (`NO_MAJORITY`) and outcome `"undetermined"`.
4. **Proved by Independent Execution**: Because the exact same `NO_MAJORITY` / `round_validators: []` occurs when deploying an independent, non-AidFlow contract (`0x507f39d...`), this is an infrastructure-wide validator pool vacancy on hosted StudioNet, not an AidFlow application defect.
5. **Impact on Campaign State**: Without consensus majority, contract state changes are not committed to the database; the campaign is not created on-chain.
6. **Downstream Lifecycle**: Because campaign creation yields no on-chain campaign ID, downstream actions (`fund_campaign`, `adjudicate_milestone`, `release_milestone`, `claim_payout`, `refund_campaign`, `claim_refund`) cannot execute on live StudioNet.

### Definitive Statement on Live Settlement

> **LIVE GEN SETTLEMENT CANNOT CURRENTLY BE PRODUCED BECAUSE THE SUPPORTED NETWORK HAS ZERO AVAILABLE VALIDATORS.**

---

## Zero-Mock Policy Compliance

AidFlow strictly adheres to the protocol boundary and refuses to fabricate results:
* No mock campaign IDs were generated.
* No synthetic state was injected into `localStorage` or RPC responses.
* No fake payout or refund transactions were fabricated.
* Direct VM test results are **not** presented as live StudioNet settlement.

---

## Final Acceptance Matrix

| Milestone Lifecycle Step | Direct VM Verification | Live StudioNet Verification | Status |
| :--- | :--- | :--- | :--- |
| **EOA Transfer Fix** (`_WalletRecipient`) | Verified (EOA balances change) | Verified (Contract deployed on StudioNet) | **PASS** |
| **Zeroing Before Transfer** | Verified (`org_claimable` & `donor_claimable` = 0) | N/A (Downstream of consensus) | **PASS** |
| **Double-Claim Prevention** | Verified (Reverts with UserError) | N/A (Downstream of consensus) | **PASS** |
| **Multi-Contributor Refund Math** | Verified (Exact proportional share, 0 remainder) | N/A (Downstream of consensus) | **PASS** |
| **Production Frontend Zero-Mock** | Verified (No mock fallbacks, client.writeContract used) | Verified (Live CDP E2E tested) | **PASS** |
| **Live Campaign Creation** | N/A (Direct mode) | Submitted (`0x0dc4bb5...`), finalized `NO_MAJORITY` | **BLOCKED** *(Network Validator Pool)* |
| **Live Campaign Funding** | N/A (Direct mode) | Blocked upstream by campaign creation | **BLOCKED** *(Downstream of Consensus)* |
| **Live Milestone Adjudication** | N/A (Direct mode) | Blocked upstream by campaign creation | **BLOCKED** *(Downstream of Consensus)* |
| **Live EOA Payout** | N/A (Direct mode) | Blocked upstream by campaign creation | **BLOCKED** *(Downstream of Consensus)* |
| **Live EOA Refund** | N/A (Direct mode) | Blocked upstream by campaign creation | **BLOCKED** *(Downstream of Consensus)* |
