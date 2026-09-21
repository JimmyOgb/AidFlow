# AidFlow Walkthrough & Demo Guide

This guide walks through the **Community Food Relief** reference campaign, demonstrating both a successful verification lifecycle and the handling of insufficient evidence (`INCONCLUSIVE`).

---

## Example Scenario: Community Food Relief

- **Target**: Provide 50 nutritional emergency food packages to vulnerable households in a designated crisis zone.
- **Escrow Funding**: 100.00 GEN deposited into the AidFlow Intelligent Contract.
- **Milestone Tranches**:
  1. **Milestone 1**: Purchase 50 food packages — **30 GEN**
  2. **Milestone 2**: Distribute 50 packages — **50 GEN**
  3. **Milestone 3**: Submit beneficiary confirmation & audit — **20 GEN**

---

## Running the Deterministic Demo Flow

Execute the demo script:
```bash
python scripts/demo.py
```

### Execution Output Breakdown

```
======================================================================
 AIDFLOW: AUTONOMOUS HUMANITARIAN AID PROTOCOL DEMO
======================================================================
Protocol Pipeline: DONOR -> ESCROW -> ORGANIZATION -> EVIDENCE -> GENLAYER -> RELEASE/HOLD

[STEP 1] Deploy AidFlow Intelligent Contract
         GenLayer Python Contract with Custom Consensus Strategy
  [OK] AidFlow contract loaded and activated in GenLayer environment.

[STEP 2] Donor Creates Humanitarian Campaign
         Title: Community Food Relief | Target: 50 Food Packages
  [OK] Campaign #0 created by Donor (0101010101...)
  [OK] Registered Organization: 0202020202...
  [OK] Total Milestone Funding: 100.00 GEN across 3 tranches (30 / 50 / 20)

[STEP 3] Donor Funds On-Chain Escrow
         Depositing 100.00 GEN into payable escrow
  [OK] Escrow Locked Balance: 100.00 GEN
  [OK] Campaign Status: FUNDED

[STEP 4] Milestone 1: Purchase 50 Food Packages (30 GEN)
         Organization submits invoices & intake logs
  [OK] 2 Evidence items submitted by Organization to GenLayer.
  -> GenLayer Validators adjudicating evidence non-deterministically...
  [OK] Consensus Decision: PASS
  [OK] Criteria Met: 2 / 2
  [OK] Reason: "Itemized supplier receipt and warehouse intake manifest conclusively satisfy procurement criteria."
  -> Releasing Milestone 1 Escrow Tranche (30 GEN)...
  [OK] Milestone 1 Status: RELEASED
  [OK] Organization Claimable Payout: 30.00 GEN

[STEP 5] Milestone 2: Distribute 50 Packages (50 GEN)
         Scenario: Insufficient evidence triggers INCONCLUSIVE
  -> GenLayer Validators adjudicating incomplete submission...
  [HOLD] Consensus Decision: INCONCLUSIVE (Funds remain safely LOCKED in escrow)
  [HOLD] Reason: "Transit receipt alone is insufficient. Missing household distribution roster and field photographs."

  -> Organization submits supplementary distribution roster & photographs...
  -> GenLayer Validators re-adjudicating with full supplementary evidence...
  [OK] Re-evaluation Decision: PASS
  -> Releasing Milestone 2 Escrow Tranche (50 GEN)...
  [OK] Cumulative Organization Claimable Payout: 80.00 GEN

[STEP 6] Milestone 3: Beneficiary Confirmation (20 GEN)
         Beneficiary sign-offs + Web verification
  [OK] Milestone 3 Adjudicated and Released (20 GEN).

[STEP 7] Final Escrow Settlement & Payout Claim
         Organization withdraws full 100.00 GEN earned funds
  [OK] Campaign Total Funding:    100.00 GEN
  [OK] Total Funds Escrowed:      100.00 GEN
  [OK] Total Tranches Released:   100.00 GEN
  [OK] Remaining Escrow:          0.00 GEN
  [OK] Organization claimed:      100.00 GEN (Claimable balance now 0.00 GEN)

======================================================================
 AIDFLOW COMPLETE LIFECYCLE VERIFICATION SUCCESSFUL!
======================================================================
```

---

## Running the Direct Test Suite

To run all 10 automated test cases:
```bash
pytest tests/direct/ -v
```

The test suite covers:
- `test_campaign_creation`: Initializes 3-milestone campaigns and verifies state.
- `test_campaign_creation_validation`: Catches empty titles, zero amounts, self-dealing donor=org.
- `test_funding_campaign`: Tests payable deposits and transition from `ACTIVE` to `FUNDED`.
- `test_funding_rejections`: Rejects zero-value deposits and funding exceeding campaign goals.
- `test_evidence_submission_and_access_control`: Rejects unauthorized submitters and validates multi-modal evidence indexing.
- `test_adjudication_pass_and_tranche_release`: Verifies LLM `PASS` verdict, double-release prevention, and escrow payout.
- `test_adjudication_inconclusive_then_supplement_evidence`: Demonstrates escrow lock on `INCONCLUSIVE` and resolution upon supplementary evidence.
- `test_adjudication_fail_and_donor_refund`: Rejects fraudulent evidence, locks tranche, and allows donor escrow refund.
- `test_insufficient_escrow_balance_release_rejection`: Prevents releasing more than the current escrow balance.
- `test_adjudication_with_web_evidence`: Tests live HTTP mocking and stable fact extraction from external web evidence.
