"""
AidFlow Deterministic End-to-End Demo
Demonstrates the full autonomous humanitarian aid escrow lifecycle:
DONOR -> ESCROW -> ORGANIZATION -> EVIDENCE -> GENLAYER CONSENSUS -> RELEASE/HOLD
"""

import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from gltest.direct.vm import VMContext
from gltest.direct.loader import deploy_contract, create_address

def print_banner(title: str):
    print("\n" + "=" * 70)
    print(f" {title.upper()}")
    print("=" * 70)

def print_step(step_num: int, title: str, description: str = ""):
    print(f"\n[STEP {step_num}] {title}")
    if description:
        print(f"         {description}")

def format_gen(atto: int) -> str:
    return f"{atto / 10**18:.2f} GEN"

def run_demo():
    print_banner("AidFlow: Autonomous Humanitarian Aid Protocol Demo")
    print("Protocol Pipeline: DONOR -> ESCROW -> ORGANIZATION -> EVIDENCE -> GENLAYER -> RELEASE/HOLD")

    # 1. Setup VM Context and Actors
    vm = VMContext()
    alice_donor = b"\x01" * 20
    bob_organization = b"\x02" * 20

    with vm.activate():
        # Deploy contract
        print_step(1, "Deploy AidFlow Intelligent Contract", "GenLayer Python Contract with Custom Consensus Strategy")
        vm.sender = alice_donor
        contract_path = Path(__file__).resolve().parent.parent / "contracts" / "aidflow.py"
        contract = deploy_contract(contract_path, vm)
        print("  [OK] AidFlow contract loaded and activated in GenLayer environment.")

        # 2. Create Campaign
        print_step(2, "Donor Creates Humanitarian Campaign", "Title: Community Food Relief | Target: 50 Food Packages")
        cid = contract.create_campaign(
            bob_organization,
            "Community Food Relief",
            "Emergency food kits distribution to 50 vulnerable households.",
            [30 * 10**18, 50 * 10**18, 20 * 10**18],
            [
                "Milestone 1: Purchase 50 food packages — 30 GEN",
                "Milestone 2: Distribute 50 packages — 50 GEN",
                "Milestone 3: Submit beneficiary confirmation — 20 GEN",
            ],
            [
                "2026-10-01T00:00:00Z",
                "2026-10-15T00:00:00Z",
                "2026-10-30T00:00:00Z",
            ],
            [
                "Itemized supplier invoice matching 50 food kits specifications.",
                "Household distribution records + timestamped geotagged delivery photographs.",
                "Beneficiary confirmations from recipients + public verification report.",
            ],
        )
        print(f"  [OK] Campaign #{cid} created by Donor ({alice_donor.hex()[:10]}...)")
        print(f"  [OK] Registered Organization: {bob_organization.hex()[:10]}...")
        print("  [OK] Total Milestone Funding: 100.00 GEN across 3 tranches (30 / 50 / 20)")

        # 3. Fund Campaign
        print_step(3, "Donor Funds On-Chain Escrow", "Depositing 100.00 GEN into payable escrow")
        vm.value = 100 * 10**18
        contract.fund_campaign(cid)
        c = contract.get_campaign(cid)
        print(f"  [OK] Escrow Locked Balance: {format_gen(c['funded_amount'])}")
        print(f"  [OK] Campaign Status: {c['status']}")

        # 4. Milestone 1: Evidence Submission & Passing Adjudication
        print_step(4, "Milestone 1: Purchase 50 Food Packages (30 GEN)", "Organization submits invoices & intake logs")
        vm.sender = bob_organization
        contract.submit_evidence(
            cid, 0, "RECEIPT", "ipfs://bafy-supplier-invoice-50kits", "0x3f4a9b", "Itemized supplier invoice for 50 nutritional food kits", "2026-09-20T10:00:00Z"
        )
        contract.submit_evidence(
            cid, 0, "DELIVERY_RECORD", "ipfs://bafy-warehouse-intake-manifest", "0x8e2c1d", "Warehouse receiving inspection manifest signed by inventory manager", "2026-09-20T10:30:00Z"
        )
        print("  [OK] 2 Evidence items submitted by Organization to GenLayer.")

        # Mock Validator Consensus for Milestone 1 (PASS)
        vm.mock_llm(
            r".*humanitarian aid verification validator.*",
            json.dumps({
                "decision": "PASS",
                "completion_percentage": 100,
                "evidence_quality": "HIGH",
                "criteria_met": 2,
                "criteria_total": 2,
                "reasoning": "Itemized supplier receipt and warehouse intake manifest conclusively satisfy procurement criteria."
            })
        )
        print("  -> GenLayer Validators adjudicating evidence non-deterministically...")
        contract.adjudicate_milestone(cid, 0)
        m1 = contract.get_milestone(cid, 0)
        print(f"  [OK] Consensus Decision: {m1['adjudication']['decision']}")
        print(f"  [OK] Criteria Met: {m1['adjudication']['criteria_met']} / {m1['adjudication']['criteria_total']}")
        print(f"  [OK] Reason: \"{m1['adjudication']['concise_reasoning']}\"")

        print("  -> Releasing Milestone 1 Escrow Tranche (30 GEN)...")
        contract.release_milestone(cid, 0)
        m1 = contract.get_milestone(cid, 0)
        print(f"  [OK] Milestone 1 Status: {m1['status']}")
        bal = contract.get_claimable_balances(bob_organization)
        print(f"  [OK] Organization Claimable Payout: {format_gen(bal['org_claimable'])}")

        # 5. Milestone 2: Insufficient Evidence -> INCONCLUSIVE -> Supplementary Evidence -> PASS
        print_step(5, "Milestone 2: Distribute 50 Packages (50 GEN)", "Scenario: Insufficient evidence triggers INCONCLUSIVE")
        # Step 5a: Partial evidence
        contract.submit_evidence(
            cid, 1, "RECEIPT", "ipfs://bafy-fuel-receipt-transit", "0x5a1b", "Transit fuel receipt only", "2026-09-20T12:00:00Z"
        )
        vm.clear_mocks()
        vm.mock_llm(
            r".*humanitarian aid verification validator.*",
            json.dumps({
                "decision": "INCONCLUSIVE",
                "completion_percentage": 30,
                "evidence_quality": "INSUFFICIENT",
                "criteria_met": 1,
                "criteria_total": 3,
                "reasoning": "Transit receipt alone is insufficient. Missing household distribution roster and field photographs."
            })
        )
        print("  -> GenLayer Validators adjudicating incomplete submission...")
        contract.adjudicate_milestone(cid, 1)
        m2 = contract.get_milestone(cid, 1)
        print(f"  [HOLD] Consensus Decision: {m2['adjudication']['decision']} (Funds remain safely LOCKED in escrow)")
        print(f"  [HOLD] Reason: \"{m2['adjudication']['concise_reasoning']}\"")

        # Step 5b: Organization supplements required evidence
        print("\n  -> Organization submits supplementary distribution roster & photographs...")
        contract.submit_evidence(
            cid, 1, "DELIVERY_RECORD", "ipfs://bafy-distribution-roster-50families", "0x9182ab", "Complete roster of 50 households with anonymized beneficiary identifiers", "2026-09-20T15:00:00Z"
        )
        contract.submit_evidence(
            cid, 1, "PHOTO", "ipfs://bafy-distribution-photos-geo", "0x7733cc", "12 geotagged field photos of kit handover to families at community center", "2026-09-20T15:15:00Z"
        )
        vm.clear_mocks()
        vm.mock_llm(
            r".*humanitarian aid verification validator.*",
            json.dumps({
                "decision": "PASS",
                "completion_percentage": 100,
                "evidence_quality": "HIGH",
                "criteria_met": 3,
                "criteria_total": 3,
                "reasoning": "Full distribution roster and photographic proof conclusively confirm distribution to 50 households."
            })
        )
        print("  -> GenLayer Validators re-adjudicating with full supplementary evidence...")
        contract.adjudicate_milestone(cid, 1)
        m2 = contract.get_milestone(cid, 1)
        print(f"  [OK] Re-evaluation Decision: {m2['adjudication']['decision']}")
        print("  -> Releasing Milestone 2 Escrow Tranche (50 GEN)...")
        contract.release_milestone(cid, 1)
        bal = contract.get_claimable_balances(bob_organization)
        print(f"  [OK] Cumulative Organization Claimable Payout: {format_gen(bal['org_claimable'])}")

        # 6. Milestone 3: Beneficiary Confirmations & Public Web Verification
        print_step(6, "Milestone 3: Beneficiary Confirmation (20 GEN)", "Beneficiary sign-offs + Web verification")
        contract.submit_evidence(
            cid, 2, "BENEFICIARY_CONFIRMATION", "ipfs://bafy-beneficiary-signed-forms", "0xbbcc11", "50 signed physical & digital confirmation tokens from household heads", "2026-09-20T17:00:00Z"
        )
        contract.submit_evidence(
            cid, 2, "WEB_EVIDENCE", "https://api.reliefweb.int/v1/audits/aidflow-50", "0x4422dd", "ReliefWeb independent field monitor verification log", "2026-09-20T17:30:00Z"
        )
        vm.clear_mocks()
        vm.mock_web(
            r".*reliefweb\.int/.*",
            {"status": 200, "body": json.dumps({"audit_status": "VERIFIED", "target_reached": 50})}
        )
        vm.mock_llm(
            r".*humanitarian aid verification validator.*",
            json.dumps({
                "decision": "PASS",
                "completion_percentage": 100,
                "evidence_quality": "HIGH",
                "criteria_met": 2,
                "criteria_total": 2,
                "reasoning": "Signed confirmations and external audit report verify full milestone fulfillment."
            })
        )
        contract.adjudicate_milestone(cid, 2)
        contract.release_milestone(cid, 2)
        print("  [OK] Milestone 3 Adjudicated and Released (20 GEN).")

        # 7. Final Settlement & Claim
        print_step(7, "Final Escrow Settlement & Payout Claim", "Organization withdraws full 100.00 GEN earned funds")
        c_final = contract.get_campaign(cid)
        print(f"  [OK] Campaign Total Funding:    {format_gen(c_final['total_funding'])}")
        print(f"  [OK] Total Funds Escrowed:      {format_gen(c_final['funded_amount'])}")
        print(f"  [OK] Total Tranches Released:   {format_gen(c_final['released_amount'])}")
        print(f"  [OK] Remaining Escrow:          {format_gen(c_final['funded_amount'] - c_final['released_amount'])}")

        claimed_amount = contract.claim_payout()
        print(f"  [OK] Organization claimed:      {format_gen(claimed_amount)} (Claimable balance now 0.00 GEN)")

        print_banner("AidFlow Complete Lifecycle Verification Successful!")
        print("All 3 milestones autonomously verified by GenLayer validators and settled on-chain.")

if __name__ == "__main__":
    run_demo()
