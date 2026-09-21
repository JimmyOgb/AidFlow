import json
import pytest

def to_hex(addr):
    if hasattr(addr, "as_hex"):
        return addr.as_hex.lower()
    if isinstance(addr, bytes):
        return ("0x" + addr.hex()).lower()
    return str(addr).lower()

def test_campaign_creation(direct_vm, direct_deploy, direct_alice, sample_campaign_args):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/aidflow.py")

    cid = contract.create_campaign(
        sample_campaign_args["organization"],
        sample_campaign_args["title"],
        sample_campaign_args["description"],
        sample_campaign_args["milestone_amounts"],
        sample_campaign_args["milestone_targets"],
        sample_campaign_args["milestone_deadlines"],
        sample_campaign_args["milestone_policies"],
    )

    assert cid == 0
    assert contract.get_campaign_count() == 1

    camp = contract.get_campaign(0)
    assert camp["title"] == "Community Food Relief"
    assert camp["donor"].lower() == to_hex(direct_alice)
    assert camp["organization"].lower() == to_hex(sample_campaign_args["organization"])
    assert camp["total_funding"] == 100 * 10**18
    assert camp["funded_amount"] == 0
    assert camp["released_amount"] == 0
    assert camp["status"] == "ACTIVE"
    assert camp["milestone_count"] == 3

    milestones = contract.get_campaign_milestones(0)
    assert len(milestones) == 3
    assert milestones[0]["amount"] == 30 * 10**18
    assert milestones[0]["status"] == "ACTIVE"
    assert milestones[1]["amount"] == 50 * 10**18
    assert milestones[2]["amount"] == 20 * 10**18


def test_campaign_creation_validation(direct_vm, direct_deploy, direct_alice, sample_campaign_args):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/aidflow.py")

    # Empty title
    with direct_vm.expect_revert("Title cannot be empty"):
        contract.create_campaign(
            sample_campaign_args["organization"],
            "",
            "desc",
            [10],
            ["t1"],
            ["d1"],
            ["p1"],
        )

    # Organization cannot be donor
    with direct_vm.expect_revert("Organization cannot be donor"):
        contract.create_campaign(
            direct_alice,
            "Title",
            "desc",
            [10],
            ["t1"],
            ["d1"],
            ["p1"],
        )

    # Zero milestone amount
    with direct_vm.expect_revert("Milestone amount must be positive"):
        contract.create_campaign(
            sample_campaign_args["organization"],
            "Title",
            "desc",
            [0],
            ["t1"],
            ["d1"],
            ["p1"],
        )

    # Mismatched array lengths
    with direct_vm.expect_revert("Milestone argument lengths must match"):
        contract.create_campaign(
            sample_campaign_args["organization"],
            "Title",
            "desc",
            [10, 20],
            ["t1"],
            ["d1"],
            ["p1"],
        )


def test_funding_campaign(direct_vm, direct_deploy, direct_alice, sample_campaign_args):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/aidflow.py")
    contract.create_campaign(
        sample_campaign_args["organization"],
        sample_campaign_args["title"],
        sample_campaign_args["description"],
        sample_campaign_args["milestone_amounts"],
        sample_campaign_args["milestone_targets"],
        sample_campaign_args["milestone_deadlines"],
        sample_campaign_args["milestone_policies"],
    )

    # Partial funding: 40 GEN
    direct_vm.value = 40 * 10**18
    contract.fund_campaign(0)
    camp = contract.get_campaign(0)
    assert camp["funded_amount"] == 40 * 10**18
    assert camp["status"] == "ACTIVE"

    # Remaining funding: 60 GEN
    direct_vm.value = 60 * 10**18
    contract.fund_campaign(0)
    camp = contract.get_campaign(0)
    assert camp["funded_amount"] == 100 * 10**18
    assert camp["status"] == "FUNDED"


def test_funding_rejections(direct_vm, direct_deploy, direct_alice, sample_campaign_args):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/aidflow.py")
    contract.create_campaign(
        sample_campaign_args["organization"],
        sample_campaign_args["title"],
        sample_campaign_args["description"],
        sample_campaign_args["milestone_amounts"],
        sample_campaign_args["milestone_targets"],
        sample_campaign_args["milestone_deadlines"],
        sample_campaign_args["milestone_policies"],
    )

    # Zero value rejection
    direct_vm.value = 0
    with direct_vm.expect_revert("Deposit must be positive"):
        contract.fund_campaign(0)

    # Overpay rejection: Total is 100 GEN, sending 101 GEN
    direct_vm.value = 101 * 10**18
    with direct_vm.expect_revert("Deposit exceeds total required funding"):
        contract.fund_campaign(0)


def test_evidence_submission_and_access_control(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie, sample_campaign_args
):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/aidflow.py")
    contract.create_campaign(
        direct_bob,
        sample_campaign_args["title"],
        sample_campaign_args["description"],
        sample_campaign_args["milestone_amounts"],
        sample_campaign_args["milestone_targets"],
        sample_campaign_args["milestone_deadlines"],
        sample_campaign_args["milestone_policies"],
    )

    # Stranger (Charlie) cannot submit evidence
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Only organization can submit evidence"):
        contract.submit_evidence(0, 0, "RECEIPT", "ipfs://receipt-1", "0xabc", "Vendor invoice", "2026-09-20T12:00:00Z")

    # Donor (Alice) cannot submit evidence
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Only organization can submit evidence"):
        contract.submit_evidence(0, 0, "RECEIPT", "ipfs://receipt-1", "0xabc", "Vendor invoice", "2026-09-20T12:00:00Z")

    # Invalid evidence type
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Unsupported evidence type"):
        contract.submit_evidence(0, 0, "INVALID_TYPE", "ipfs://bad", "0xabc", "Bad", "2026-09-20T12:00:00Z")

    # Valid submission by organization (Bob)
    contract.submit_evidence(
        0, 0, "RECEIPT", "ipfs://bafy-receipt-food-50", "0xhash123", "Itemized purchase receipt for 50 food kits", "2026-09-20T12:00:00Z"
    )
    contract.submit_evidence(
        0, 0, "PHOTO", "ipfs://bafy-photo-warehouse", "0xhash456", "Timestamped photo of 50 packed kits ready for dispatch", "2026-09-20T12:15:00Z"
    )

    m = contract.get_milestone(0, 0)
    assert m["status"] == "EVIDENCE_SUBMITTED"
    assert m["evidence_count"] == 2

    e0 = contract.get_milestone_evidence(0, 0, 0)
    assert e0["evidence_type"] == "RECEIPT"
    assert e0["uri"] == "ipfs://bafy-receipt-food-50"

    e1 = contract.get_milestone_evidence(0, 0, 1)
    assert e1["evidence_type"] == "PHOTO"
    assert e1["uri"] == "ipfs://bafy-photo-warehouse"


def test_adjudication_pass_and_tranche_release(
    direct_vm, direct_deploy, direct_alice, direct_bob, sample_campaign_args
):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/aidflow.py")
    contract.create_campaign(
        direct_bob,
        sample_campaign_args["title"],
        sample_campaign_args["description"],
        sample_campaign_args["milestone_amounts"],
        sample_campaign_args["milestone_targets"],
        sample_campaign_args["milestone_deadlines"],
        sample_campaign_args["milestone_policies"],
    )

    # Fund 100 GEN
    direct_vm.value = 100 * 10**18
    contract.fund_campaign(0)

    # Bob submits evidence for Milestone 0
    direct_vm.sender = direct_bob
    contract.submit_evidence(0, 0, "RECEIPT", "ipfs://receipt", "0x1", "Itemized invoice for 50 kits", "2026-09-20T12:00:00Z")
    contract.submit_evidence(0, 0, "DELIVERY_RECORD", "ipfs://delivery", "0x2", "Warehouse intake log", "2026-09-20T12:05:00Z")

    # Mock LLM for PASS
    pass_response = json.dumps({
        "decision": "PASS",
        "completion_percentage": 100,
        "evidence_quality": "HIGH",
        "criteria_met": 2,
        "criteria_total": 2,
        "reasoning": "Receipt and delivery intake log conclusively confirm 50 food kits purchased."
    })
    direct_vm.mock_llm(r".*humanitarian aid verification validator.*", pass_response)

    # Adjudicate milestone 0
    contract.adjudicate_milestone(0, 0)

    m = contract.get_milestone(0, 0)
    assert m["status"] == "PASSED"
    assert m["adjudication"]["decision"] == "PASS"
    assert m["adjudication"]["completion_percentage"] == 100
    assert m["adjudication"]["evidence_quality"] == "HIGH"
    assert m["adjudication"]["criteria_met"] == 2

    # Release milestone 0 (30 GEN)
    contract.release_milestone(0, 0)

    m = contract.get_milestone(0, 0)
    assert m["status"] == "RELEASED"

    camp = contract.get_campaign(0)
    assert camp["released_amount"] == 30 * 10**18

    balances = contract.get_claimable_balances(direct_bob)
    assert balances["org_claimable"] == 30 * 10**18

    # Double release prevention
    with direct_vm.expect_revert("Milestone has not passed adjudication: status is RELEASED"):
        contract.release_milestone(0, 0)

    # Bob claims payout
    direct_vm.sender = direct_bob
    claimed = contract.claim_payout()
    assert claimed == 30 * 10**18

    balances = contract.get_claimable_balances(direct_bob)
    assert balances["org_claimable"] == 0


def test_adjudication_inconclusive_then_supplement_evidence(
    direct_vm, direct_deploy, direct_alice, direct_bob, sample_campaign_args
):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/aidflow.py")
    contract.create_campaign(
        direct_bob,
        sample_campaign_args["title"],
        sample_campaign_args["description"],
        sample_campaign_args["milestone_amounts"],
        sample_campaign_args["milestone_targets"],
        sample_campaign_args["milestone_deadlines"],
        sample_campaign_args["milestone_policies"],
    )

    # Fund 100 GEN
    direct_vm.value = 100 * 10**18
    contract.fund_campaign(0)

    # Bob submits insufficient evidence: single receipt only
    direct_vm.sender = direct_bob
    contract.submit_evidence(0, 1, "RECEIPT", "ipfs://partial-receipt", "0xabc", "Preliminary receipt only", "2026-09-20T12:00:00Z")

    # Mock LLM for INCONCLUSIVE
    inconclusive_response = json.dumps({
        "decision": "INCONCLUSIVE",
        "completion_percentage": 40,
        "evidence_quality": "INSUFFICIENT",
        "criteria_met": 1,
        "criteria_total": 3,
        "reasoning": "Only a preliminary receipt provided. Distribution logs and photos are missing."
    })
    direct_vm.mock_llm(r".*humanitarian aid verification validator.*", inconclusive_response)

    contract.adjudicate_milestone(0, 1)

    m = contract.get_milestone(0, 1)
    assert m["status"] == "INCONCLUSIVE"
    assert m["adjudication"]["decision"] == "INCONCLUSIVE"

    # Funds remain locked - cannot release
    with direct_vm.expect_revert("Milestone has not passed adjudication: status is INCONCLUSIVE"):
        contract.release_milestone(0, 1)

    # Organization submits supplementary evidence
    contract.submit_evidence(0, 1, "DELIVERY_RECORD", "ipfs://full-distribution-list", "0xdef", "Complete household distribution roster", "2026-09-20T14:00:00Z")
    contract.submit_evidence(0, 1, "PHOTO", "ipfs://photos-distribution", "0xghi", "Distribution event photos with geo markers", "2026-09-20T14:10:00Z")

    m = contract.get_milestone(0, 1)
    assert m["status"] == "EVIDENCE_SUBMITTED"
    assert m["evidence_count"] == 3

    # Re-adjudicate with passing evidence
    pass_response = json.dumps({
        "decision": "PASS",
        "completion_percentage": 100,
        "evidence_quality": "HIGH",
        "criteria_met": 3,
        "criteria_total": 3,
        "reasoning": "Roster and photographic proof satisfactorily resolve all criteria."
    })
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*humanitarian aid verification validator.*", pass_response)

    contract.adjudicate_milestone(0, 1)
    m = contract.get_milestone(0, 1)
    assert m["status"] == "PASSED"
    assert m["adjudication"]["decision"] == "PASS"

    # Now release succeeds
    contract.release_milestone(0, 1)
    m = contract.get_milestone(0, 1)
    assert m["status"] == "RELEASED"


def test_adjudication_fail_and_donor_refund(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie, sample_campaign_args
):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/aidflow.py")
    contract.create_campaign(
        direct_bob,
        sample_campaign_args["title"],
        sample_campaign_args["description"],
        sample_campaign_args["milestone_amounts"],
        sample_campaign_args["milestone_targets"],
        sample_campaign_args["milestone_deadlines"],
        sample_campaign_args["milestone_policies"],
    )

    # Fund 100 GEN
    direct_vm.value = 100 * 10**18
    contract.fund_campaign(0)

    # Submit evidence for Milestone 0
    direct_vm.sender = direct_bob
    contract.submit_evidence(0, 0, "RECEIPT", "ipfs://fake", "0x00", "Contradictory fake document", "2026-09-20T12:00:00Z")

    # Mock LLM for FAIL
    fail_response = json.dumps({
        "decision": "FAIL",
        "completion_percentage": 0,
        "evidence_quality": "LOW",
        "criteria_met": 0,
        "criteria_total": 2,
        "reasoning": "Evidence is plainly fraudulent or fabricated."
    })
    direct_vm.mock_llm(r".*humanitarian aid verification validator.*", fail_response)

    contract.adjudicate_milestone(0, 0)
    m = contract.get_milestone(0, 0)
    assert m["status"] == "FAILED"

    # Cannot release failed milestone
    with direct_vm.expect_revert("Milestone has not passed adjudication: status is FAILED"):
        contract.release_milestone(0, 0)

    # Stranger cannot trigger refund
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Only donor can trigger refund"):
        contract.refund_campaign(0)

    # Donor triggers refund
    direct_vm.sender = direct_alice
    contract.refund_campaign(0)

    camp = contract.get_campaign(0)
    assert camp["status"] == "REFUNDED"
    assert camp["refunded_amount"] == 100 * 10**18

    # Donor claims refund
    refund_amount = contract.claim_refund()
    assert refund_amount == 100 * 10**18

    balances = contract.get_claimable_balances(direct_alice)
    assert balances["donor_claimable"] == 0


def test_insufficient_escrow_balance_release_rejection(
    direct_vm, direct_deploy, direct_alice, direct_bob, sample_campaign_args
):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/aidflow.py")
    contract.create_campaign(
        direct_bob,
        sample_campaign_args["title"],
        sample_campaign_args["description"],
        sample_campaign_args["milestone_amounts"], # [30, 50, 20] GEN
        sample_campaign_args["milestone_targets"],
        sample_campaign_args["milestone_deadlines"],
        sample_campaign_args["milestone_policies"],
    )

    # Only fund 20 GEN (less than milestone 0 requirement of 30 GEN)
    direct_vm.value = 20 * 10**18
    contract.fund_campaign(0)

    direct_vm.sender = direct_bob
    contract.submit_evidence(0, 0, "RECEIPT", "ipfs://receipt", "0x1", "Invoice", "2026-09-20T12:00:00Z")

    pass_response = json.dumps({
        "decision": "PASS",
        "completion_percentage": 100,
        "evidence_quality": "HIGH",
        "criteria_met": 1,
        "criteria_total": 1,
        "reasoning": "Valid"
    })
    direct_vm.mock_llm(r".*humanitarian aid verification validator.*", pass_response)
    contract.adjudicate_milestone(0, 0)

    # Attempting to release 30 GEN when only 20 GEN funded must revert!
    with direct_vm.expect_revert("Insufficient escrow balance to release milestone tranche"):
        contract.release_milestone(0, 0)


def test_adjudication_with_web_evidence(
    direct_vm, direct_deploy, direct_alice, direct_bob, sample_campaign_args
):
    direct_vm.sender = direct_alice
    contract = direct_deploy("contracts/aidflow.py")
    contract.create_campaign(
        direct_bob,
        sample_campaign_args["title"],
        sample_campaign_args["description"],
        sample_campaign_args["milestone_amounts"],
        sample_campaign_args["milestone_targets"],
        sample_campaign_args["milestone_deadlines"],
        sample_campaign_args["milestone_policies"],
    )

    direct_vm.value = 100 * 10**18
    contract.fund_campaign(0)

    # Bob submits WEB_EVIDENCE
    direct_vm.sender = direct_bob
    contract.submit_evidence(
        0, 0, "WEB_EVIDENCE", "https://api.reliefweb.int/v1/reports/12345", "0xwebhash", "ReliefWeb public verification report", "2026-09-20T12:00:00Z"
    )

    # Mock web request for the URL
    direct_vm.mock_web(
        r".*reliefweb\.int/v1/reports.*",
        {
            "status": 200,
            "body": json.dumps({"status": "verified", "delivered_kits": 50, "beneficiaries_reached": 250}),
        },
    )

    pass_response = json.dumps({
        "decision": "PASS",
        "completion_percentage": 100,
        "evidence_quality": "HIGH",
        "criteria_met": 2,
        "criteria_total": 2,
        "reasoning": "External reliefweb facts confirm 50 kits delivered."
    })
    direct_vm.mock_llm(r".*humanitarian aid verification validator.*", pass_response)

    contract.adjudicate_milestone(0, 0)
    m = contract.get_milestone(0, 0)
    assert m["status"] == "PASSED"
    assert m["adjudication"]["decision"] == "PASS"

