# AidFlow Architecture Specification

## Overview

**AidFlow** is an autonomous humanitarian aid escrow and outcome-verification protocol built on **GenLayer**. It solves the core transparency and verification dilemma in humanitarian aid financing:

> Traditional grants release capital either upfront (carrying high risk of misappropriation or non-delivery) or after manual off-chain audits (causing months of delay and overhead). AidFlow replaces manual gatekeepers with **autonomous GenLayer Intelligent Contracts** that evaluate on-chain and external multi-modal evidence to adjudicate milestone fulfillment and release escrowed funds.

---

## The Protocol Pipeline

```
┌─────────┐      Payable GEN      ┌────────────────┐     Submit Evidence     ┌──────────────┐
│  DONOR  │ ────────────────────> │ AIDFLOW ESCROW │ <────────────────────── │ ORGANIZATION │
└─────────┘                       └──────┬─────────┘                         └──────────────┘
                                         │
                                         ▼
                     ┌──────────────────────────────────────┐
                     │          GENLAYER CONSENSUS          │
                     │  (Multi-Validator LLM Adjudication)  │
                     └───────────────────┬──────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
           [PASS VERDICT]                                [INCONCLUSIVE / FAIL]
                 │                                               │
                 ▼                                               ▼
     ┌───────────────────────┐                       ┌───────────────────────┐
     │ RELEASE TRANCHE FUNDS │                       │ FUNDS REMAIN LOCKED   │
     │ TO ORGANIZATION       │                       │ (Supplementary        │
     └───────────────────────┘                       │  Evidence Allowed)    │
                                                     └───────────────────────┘
```

---

## Visual Adjudication Lifecycle

The protocol enforces a 4-phase verification cycle:

```
┌─────────────┐       ┌─────────────┐       ┌───────────────┐       ┌─────────────┐
│ 1. OBSERVE  │ ----> │  2. VERIFY  │ ----> │ 3. CONSENSUS  │ ----> │ 4. RELEASE  │
└─────────────┘       └─────────────┘       └───────────────┘       └─────────────┘
  Intake evidence       Validators            Substantive             Automated
  metadata, URIs,       independently         equivalence on          escrow release
  and web sources       execute LLM           decision &              to recipient
                        scoring               tolerances              balance
```

1. **OBSERVE (Evidence Intake)**: Local organizations submit verifiable evidence references (supplier invoices, warehouse delivery manifests, geotagged photographs, beneficiary signatures, web verification records) along with SHA-256 integrity hashes.
2. **VERIFY (Multi-Validator LLM)**: Each validator independently inspects the defined milestone criteria against submitted evidence items and external web endpoints.
3. **CONSENSUS (Equivalence Principle)**: Rather than requiring byte-for-byte exact equality on free-form LLM explanations (which always fails consensus), validators enforce substantive agreement on:
   - Categorical decision: `PASS`, `FAIL`, or `INCONCLUSIVE`.
   - Completion percentage score (within ±20 tolerance).
   - Criteria satisfied count (within ±1 tolerance).
4. **RELEASE (Deterministic Settlement)**: Once consensus is finalized, the smart contract transitions milestone state to `PASSED` and permits release of the escrowed tranche.

---

## Contract State & Data Structures

The smart contract [`contracts/aidflow.py`](../contracts/aidflow.py) implements the following models:

### 1. EvidenceRef
```python
@allow_storage
@dataclass
class EvidenceRef:
    evidence_type: str        # RECEIPT, DELIVERY_RECORD, PHOTO, GEOGRAPHIC, BENEFICIARY_CONFIRMATION, ORG_REPORT, WEB_EVIDENCE
    uri: str                  # IPFS, Arweave, or HTTPS URI
    metadata_hash: str        # SHA-256 hash of evidence document
    description: str          # Descriptive summary
    submitted_at: str         # ISO 8601 timestamp
```

### 2. Milestone
```python
@allow_storage
@dataclass
class Milestone:
    id: u256
    amount: u256              # Atto-scale native GEN (amount * 10^18)
    target: str               # Human-readable milestone goal
    deadline: str             # Expiration timestamp
    verification_policy: str  # Rules and criteria for validators
    status: str               # ACTIVE, EVIDENCE_SUBMITTED, ADJUDICATING, PASSED, FAILED, INCONCLUSIVE, RELEASED
    evidence_count: u256
    decision: str             # PENDING, PASS, FAIL, INCONCLUSIVE
    completion_percentage: u256
    evidence_quality: str     # HIGH, MEDIUM, LOW, INSUFFICIENT
    criteria_met: u256
    criteria_total: u256
    concise_reasoning: str
    evaluated_at: str
```

### 3. Campaign
```python
@allow_storage
@dataclass
class Campaign:
    id: u256
    donor: Address            # Funder address
    organization: Address     # Recipient aid entity
    title: str
    description: str
    total_funding: u256       # Sum of milestone amounts
    funded_amount: u256       # Escrow balance deposited
    released_amount: u256     # Total tranches disbursed
    refunded_amount: u256     # Funds returned to donor upon failure
    status: str               # ACTIVE, FUNDED, COMPLETED, REFUNDED
    milestone_count: u256
```

---

## Security Model & Safety Invariants

1. **Payable Escrow Integrity**:
   - Only `fund_campaign()` can receive native GEN.
   - Zero-value deposits revert immediately.
   - Cumulative funding cannot exceed `campaign.total_funding`.
2. **Access Control**:
   - Only `campaign.organization` can submit evidence for that campaign's milestones.
   - Only `campaign.donor` can trigger refund of unreleased escrow balance.
   - Random accounts cannot alter campaign or milestone states.
3. **Double-Release Prevention**:
   - Releasing a milestone marks its status as `RELEASED`.
   - Attempts to release an already released milestone immediately revert.
4. **Escrow Solvency Invariant**:
   - `released_amount + milestone.amount <= funded_amount`.
   - Contract tracks claimable ledgers per recipient (`org_claimable` and `donor_claimable`), preventing re-entrancy and double withdrawals.
5. **No Admin Backdoors**:
   - Neither the contract deployer nor any administrator can unilaterally confiscate escrowed funds. Funds only move via verified milestone release or donor refund upon milestone failure/cancellation.

---

## GenVM Non-Deterministic Consensus Strategy

Traditional blockchains cannot evaluate natural language policies or subjective documentation. GenLayer enables non-deterministic execution using `gl.vm.run_nondet_unsafe`:

```python
def leader_fn():
    # 1. Fetch stable web data if WEB_EVIDENCE is provided
    # 2. Compile prompt with criteria and evidence summaries
    # 3. Call gl.nondet.exec_prompt(prompt, response_format="json")
    # 4. Defensively normalize output into structured adjudication fields
    return {
        "decision": decision,
        "completion_percentage": comp,
        "evidence_quality": quality,
        "criteria_met": c_met,
        "criteria_total": c_total,
        "reasoning": reasoning,
    }

def validator_fn(leaders_res: gl.vm.Result) -> bool:
    # 1. Re-execute the leader_fn independently
    v_result = leader_fn()
    leader_data = leaders_res.calldata

    # 2. Compare substantive fields:
    if leader_data["decision"] != v_result["decision"]:
        return False
    if abs(leader_data["completion_percentage"] - v_result["completion_percentage"]) > 20:
        return False
    if abs(leader_data["criteria_met"] - v_result["criteria_met"]) > 1:
        return False

    # Never compare free-form reasoning with strict string equality!
    return True
```

This ensures validators independently inspect the substantive merits of the evidence rather than simply checking if the leader's JSON was formatted properly.
