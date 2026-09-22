# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
import re
from dataclasses import dataclass
from typing import Any
import genlayer.gl as gl
from genlayer import *

ERROR_EXPECTED = "[EXPECTED]"
ERROR_EXTERNAL = "[EXTERNAL]"
ERROR_TRANSIENT = "[TRANSIENT]"
ERROR_LLM = "[LLM_ERROR]"

VALID_EVIDENCE_TYPES = {
    "RECEIPT",
    "DELIVERY_RECORD",
    "PHOTO",
    "GEOGRAPHIC",
    "BENEFICIARY_CONFIRMATION",
    "ORG_REPORT",
    "WEB_EVIDENCE",
}

STATUS_DRAFT = "DRAFT"
STATUS_FUNDED = "FUNDED"
STATUS_ACTIVE = "ACTIVE"
STATUS_EVIDENCE_SUBMITTED = "EVIDENCE_SUBMITTED"
STATUS_ADJUDICATING = "ADJUDICATING"
STATUS_PASSED = "PASSED"
STATUS_FAILED = "FAILED"
STATUS_INCONCLUSIVE = "INCONCLUSIVE"
STATUS_RELEASED = "RELEASED"
STATUS_REFUNDED = "REFUNDED"

DECISION_PASS = "PASS"
DECISION_FAIL = "FAIL"
DECISION_INCONCLUSIVE = "INCONCLUSIVE"
DECISION_PENDING = "PENDING"


@allow_storage
@dataclass
class EvidenceRef:
    evidence_type: str
    uri: str
    metadata_hash: str
    description: str
    submitted_at: str


@allow_storage
@dataclass
class Milestone:
    id: u256
    amount: u256
    target: str
    deadline: str
    verification_policy: str
    status: str
    evidence_count: u256
    decision: str
    completion_percentage: u256
    evidence_quality: str
    criteria_met: u256
    criteria_total: u256
    concise_reasoning: str
    evaluated_at: str


@allow_storage
@dataclass
class Campaign:
    id: u256
    donor: Address
    organization: Address
    title: str
    description: str
    total_funding: u256
    funded_amount: u256
    released_amount: u256
    refunded_amount: u256
    status: str
    milestone_count: u256


def _clean_llm_json(raw: str) -> dict:
    if not isinstance(raw, str):
        if isinstance(raw, dict):
            return raw
        raise gl.vm.UserError(f"{ERROR_LLM} Invalid prompt response type: {type(raw)}")
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise gl.vm.UserError(f"{ERROR_LLM} No valid JSON object found in response")
    trimmed = raw[start : end + 1]
    cleaned = re.sub(r",(?!\s*?[\{\[\"\'\w])", "", trimmed)
    try:
        return json.loads(cleaned)
    except Exception as exc:
        raise gl.vm.UserError(f"{ERROR_LLM} Failed parsing JSON: {exc}")


def _handle_leader_error(leaders_res: Any, leader_fn: Any) -> bool:
    leader_msg = getattr(leaders_res, "message", "")
    try:
        leader_fn()
        return False
    except gl.vm.UserError as e:
        val_msg = getattr(e, "message", str(e))
        if val_msg.startswith(ERROR_EXPECTED) or val_msg.startswith(ERROR_EXTERNAL):
            return val_msg == leader_msg
        if val_msg.startswith(ERROR_TRANSIENT) and leader_msg.startswith(ERROR_TRANSIENT):
            return True
        return False
    except Exception:
        return False


def _to_addr(val: Any) -> Address:
    if isinstance(val, Address):
        return val
    return Address(val)


def _addr_hex(addr: Any) -> str:
    if hasattr(addr, "as_hex"):
        return addr.as_hex
    if isinstance(addr, bytes):
        return "0x" + addr.hex()
    return str(addr)


class AidFlow(gl.Contract):
    campaign_count: u256
    campaigns: TreeMap[u256, Campaign]
    milestones: TreeMap[str, Milestone]
    evidence_records: TreeMap[str, EvidenceRef]
    org_claimable: TreeMap[Address, u256]
    donor_claimable: TreeMap[Address, u256]
    contributions: TreeMap[str, u256]
    contributor_counts: TreeMap[u256, u256]
    contributor_addrs: TreeMap[str, Address]

    def __init__(self):
        self.campaign_count = 0

    # -------------------------------------------------------------------------
    # Internal key helpers
    # -------------------------------------------------------------------------
    def _mkey(self, campaign_id: u256, milestone_id: u256) -> str:
        return f"{campaign_id}_{milestone_id}"

    def _ekey(self, campaign_id: u256, milestone_id: u256, evidence_idx: u256) -> str:
        return f"{campaign_id}_{milestone_id}_{evidence_idx}"

    # -------------------------------------------------------------------------
    # Views
    # -------------------------------------------------------------------------
    @gl.public.view
    def get_campaign_count(self) -> u256:
        return self.campaign_count

    @gl.public.view
    def get_campaign(self, campaign_id: u256) -> dict:
        if campaign_id >= self.campaign_count:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Campaign not found")
        c = self.campaigns[campaign_id]
        return {
            "id": c.id,
            "donor": _addr_hex(c.donor),
            "organization": _addr_hex(c.organization),
            "title": c.title,
            "description": c.description,
            "total_funding": c.total_funding,
            "funded_amount": c.funded_amount,
            "released_amount": c.released_amount,
            "refunded_amount": c.refunded_amount,
            "status": c.status,
            "milestone_count": c.milestone_count,
        }

    @gl.public.view
    def get_milestone(self, campaign_id: u256, milestone_id: u256) -> dict:
        if campaign_id >= self.campaign_count:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Campaign not found")
        c = self.campaigns[campaign_id]
        if milestone_id >= c.milestone_count:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Milestone not found")
        m = self.milestones[self._mkey(campaign_id, milestone_id)]
        return {
            "id": m.id,
            "amount": m.amount,
            "target": m.target,
            "deadline": m.deadline,
            "verification_policy": m.verification_policy,
            "status": m.status,
            "evidence_count": m.evidence_count,
            "adjudication": {
                "decision": m.decision,
                "completion_percentage": m.completion_percentage,
                "evidence_quality": m.evidence_quality,
                "criteria_met": m.criteria_met,
                "criteria_total": m.criteria_total,
                "concise_reasoning": m.concise_reasoning,
                "evaluated_at": m.evaluated_at,
            },
        }

    @gl.public.view
    def get_campaign_milestones(self, campaign_id: u256) -> list:
        if campaign_id >= self.campaign_count:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Campaign not found")
        c = self.campaigns[campaign_id]
        items = []
        for i in range(c.milestone_count):
            items.append(self.get_milestone(campaign_id, i))
        return items

    @gl.public.view
    def get_milestone_evidence(self, campaign_id: u256, milestone_id: u256, evidence_idx: u256) -> dict:
        k = self._ekey(campaign_id, milestone_id, evidence_idx)
        if k not in self.evidence_records:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Evidence record not found")
        e = self.evidence_records[k]
        return {
            "evidence_type": e.evidence_type,
            "uri": e.uri,
            "metadata_hash": e.metadata_hash,
            "description": e.description,
            "submitted_at": e.submitted_at,
        }

    @gl.public.view
    def get_claimable_balances(self, account: Address) -> dict:
        acc = _to_addr(account)
        return {
            "org_claimable": self.org_claimable.get(acc, 0),
            "donor_claimable": self.donor_claimable.get(acc, 0),
        }

    def _has_failed_milestone(self, campaign_id: u256) -> bool:
        c = self.campaigns[campaign_id]
        for i in range(c.milestone_count):
            m = self.milestones[self._mkey(campaign_id, i)]
            if m.status == STATUS_FAILED:
                return True
        return False

    @gl.public.view
    def is_campaign_refundable(self, campaign_id: u256) -> bool:
        if campaign_id >= self.campaign_count:
            return False
        c = self.campaigns[campaign_id]
        if c.status == STATUS_REFUNDED:
            return False
        unreleased = c.funded_amount - c.released_amount - c.refunded_amount
        if unreleased == 0:
            return False
        return self._has_failed_milestone(campaign_id)

    @gl.public.view
    def get_contributor_amount(self, campaign_id: u256, contributor: Address) -> u256:
        if campaign_id >= self.campaign_count:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Campaign not found")
        ckey = f"{campaign_id}_{_addr_hex(_to_addr(contributor))}"
        return self.contributions.get(ckey, 0)

    # -------------------------------------------------------------------------
    # Campaign Creation & Escrow Management
    # -------------------------------------------------------------------------
    @gl.public.write
    def create_campaign(
        self,
        organization: Address,
        title: str,
        description: str,
        milestone_amounts: list[u256],
        milestone_targets: list[str],
        milestone_deadlines: list[str],
        milestone_policies: list[str],
    ) -> u256:
        sender = _to_addr(gl.message.sender_address)
        org = _to_addr(organization)
        if not title or len(title.strip()) == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Title cannot be empty")
        if org == Address(b"\x00" * 20):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Invalid organization address")
        if org == sender:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Organization cannot be donor")

        num_m = len(milestone_amounts)
        if num_m == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} At least one milestone is required")
        if len(milestone_targets) != num_m or len(milestone_deadlines) != num_m or len(milestone_policies) != num_m:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Milestone argument lengths must match")

        total_funds: u256 = 0
        campaign_id = self.campaign_count

        for i in range(num_m):
            amt = milestone_amounts[i]
            if amt == 0:
                raise gl.vm.UserError(f"{ERROR_EXPECTED} Milestone amount must be positive")
            total_funds += amt
            mkey = self._mkey(campaign_id, i)
            self.milestones[mkey] = Milestone(
                id=i,
                amount=amt,
                target=milestone_targets[i],
                deadline=milestone_deadlines[i],
                verification_policy=milestone_policies[i],
                status=STATUS_ACTIVE,
                evidence_count=0,
                decision=DECISION_PENDING,
                completion_percentage=0,
                evidence_quality="NONE",
                criteria_met=0,
                criteria_total=0,
                concise_reasoning="",
                evaluated_at="",
            )

        self.campaigns[campaign_id] = Campaign(
            id=campaign_id,
            donor=sender,
            organization=org,
            title=title,
            description=description,
            total_funding=total_funds,
            funded_amount=0,
            released_amount=0,
            refunded_amount=0,
            status=STATUS_ACTIVE,
            milestone_count=num_m,
        )

        self.campaign_count = campaign_id + 1
        return campaign_id

    @gl.public.write.payable
    def fund_campaign(self, campaign_id: u256) -> None:
        deposit = gl.message.value
        if deposit == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Deposit must be positive")
        if campaign_id >= self.campaign_count:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Campaign not found")

        c = self.campaigns[campaign_id]
        if c.status not in (STATUS_ACTIVE, STATUS_FUNDED):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Campaign is not open for funding")
        if c.funded_amount + deposit > c.total_funding:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Deposit exceeds total required funding")

        sender = _to_addr(gl.message.sender_address)
        ckey = f"{campaign_id}_{_addr_hex(sender)}"
        prev_contrib = self.contributions.get(ckey, 0)
        if prev_contrib == 0:
            c_count = self.contributor_counts.get(campaign_id, 0)
            self.contributor_addrs[f"{campaign_id}_{c_count}"] = sender
            self.contributor_counts[campaign_id] = c_count + 1
        self.contributions[ckey] = prev_contrib + deposit

        c.funded_amount += deposit
        if c.funded_amount == c.total_funding:
            c.status = STATUS_FUNDED
        self.campaigns[campaign_id] = c

    # -------------------------------------------------------------------------
    # Evidence Submission
    # -------------------------------------------------------------------------
    @gl.public.write
    def submit_evidence(
        self,
        campaign_id: u256,
        milestone_id: u256,
        evidence_type: str,
        uri: str,
        metadata_hash: str,
        description: str,
        timestamp: str,
    ) -> None:
        sender = _to_addr(gl.message.sender_address)
        if campaign_id >= self.campaign_count:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Campaign not found")
        c = self.campaigns[campaign_id]
        if c.status == STATUS_REFUNDED:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Campaign is refunded: no evidence can be submitted")
        if sender != _to_addr(c.organization):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only organization can submit evidence")

        if milestone_id >= c.milestone_count:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Milestone not found")

        etype = evidence_type.upper()
        if etype not in VALID_EVIDENCE_TYPES:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Unsupported evidence type: {evidence_type}")
        if not uri or len(uri.strip()) == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Evidence URI cannot be empty")

        mkey = self._mkey(campaign_id, milestone_id)
        m = self.milestones[mkey]
        if m.status not in (STATUS_ACTIVE, STATUS_FUNDED, STATUS_EVIDENCE_SUBMITTED, STATUS_INCONCLUSIVE):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Cannot submit evidence in status {m.status}")

        eidx = m.evidence_count
        ekey = self._ekey(campaign_id, milestone_id, eidx)
        self.evidence_records[ekey] = EvidenceRef(
            evidence_type=etype,
            uri=uri,
            metadata_hash=metadata_hash,
            description=description,
            submitted_at=timestamp,
        )

        m.evidence_count = eidx + 1
        m.status = STATUS_EVIDENCE_SUBMITTED
        self.milestones[mkey] = m

    # -------------------------------------------------------------------------
    # Non-deterministic Adjudication with Custom Validator Consensus
    # -------------------------------------------------------------------------
    @gl.public.write
    def adjudicate_milestone(self, campaign_id: u256, milestone_id: u256) -> None:
        if campaign_id >= self.campaign_count:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Campaign not found")
        c = self.campaigns[campaign_id]
        if c.status == STATUS_REFUNDED:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Campaign is refunded: milestone cannot be adjudicated")
        if milestone_id >= c.milestone_count:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Milestone not found")

        mkey = self._mkey(campaign_id, milestone_id)
        m = self.milestones[mkey]

        if m.status not in (STATUS_EVIDENCE_SUBMITTED, STATUS_ADJUDICATING, STATUS_INCONCLUSIVE):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Milestone evidence not ready for adjudication")
        if m.evidence_count == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} No evidence submitted for milestone")

        # Snapshot evidence inputs deterministically
        evidence_summary_lines = []
        web_evidence_urls = []
        for i in range(m.evidence_count):
            e = self.evidence_records[self._ekey(campaign_id, milestone_id, i)]
            evidence_summary_lines.append(
                f"- [Type: {e.evidence_type}] URI: {e.uri} | Hash: {e.metadata_hash} | Description: {e.description}"
            )
            if e.evidence_type == "WEB_EVIDENCE" and (e.uri.startswith("http://") or e.uri.startswith("https://")):
                web_evidence_urls.append(e.uri)

        evidence_text = "\n".join(evidence_summary_lines)
        target = m.target
        policy = m.verification_policy

        # Define non-deterministic leader and validator functions
        def leader_fn() -> dict:
            web_facts = []
            for url in web_evidence_urls:
                try:
                    res = gl.nondet.web.get(url)
                    if res and hasattr(res, "body"):
                        body_txt = res.body.decode("utf-8", errors="ignore")[:1000]
                        web_facts.append(f"Source ({url}): {body_txt}")
                except Exception:
                    web_facts.append(f"Source ({url}): [unreachable / transient]")

            web_context = ("\n\nExternal Web Verification Facts:\n" + "\n".join(web_facts)) if web_facts else ""

            prompt = f"""You are an objective humanitarian aid verification validator on GenLayer.
Evaluate whether the submitted evidence satisfies the milestone criteria.

Campaign Milestone Target:
{target}

Verification Policy & Criteria:
{policy}

Submitted Evidence Records:
{evidence_text}
{web_context}

ADJUDICATION RULES:
1. "PASS": All key criteria are conclusively supported with sufficient, verifiable evidence (e.g. valid receipts, complete delivery records, photographic proof, beneficiary sign-offs).
2. "INCONCLUSIVE": Evidence is partial, incomplete, or ambiguous (e.g., receipt only without distribution list, missing confirmation, or insufficient records). Funds must remain locked.
3. "FAIL": Evidence is fabricated, contradicts criteria, deadline violated without excuse, or target plainly unperformed.

Respond strictly in valid JSON format with this exact schema:
{{
  "decision": "PASS" | "FAIL" | "INCONCLUSIVE",
  "completion_percentage": <integer from 0 to 100>,
  "evidence_quality": "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT",
  "criteria_met": <integer count of satisfied criteria>,
  "criteria_total": <integer count of total defined criteria>,
  "reasoning": "<concise explanation under 300 characters>"
}}"""

            raw_resp = gl.nondet.exec_prompt(prompt, response_format="json")
            parsed = _clean_llm_json(raw_resp)

            # Defensive normalization
            decision = str(parsed.get("decision", "")).strip().upper()
            if decision not in (DECISION_PASS, DECISION_FAIL, DECISION_INCONCLUSIVE):
                if "PASS" in decision:
                    decision = DECISION_PASS
                elif "FAIL" in decision:
                    decision = DECISION_FAIL
                else:
                    decision = DECISION_INCONCLUSIVE

            try:
                comp = int(round(float(parsed.get("completion_percentage", 0))))
                comp = max(0, min(100, comp))
            except Exception:
                comp = 100 if decision == DECISION_PASS else (50 if decision == DECISION_INCONCLUSIVE else 0)

            quality = str(parsed.get("evidence_quality", "MEDIUM")).strip().upper()
            if quality not in ("HIGH", "MEDIUM", "LOW", "INSUFFICIENT"):
                quality = "MEDIUM"

            try:
                c_met = max(0, int(parsed.get("criteria_met", 0)))
                c_total = max(1, int(parsed.get("criteria_total", 1)))
                if c_met > c_total:
                    c_met = c_total
            except Exception:
                c_met = 1 if decision == DECISION_PASS else 0
                c_total = 1

            reasoning = str(parsed.get("reasoning", "")).strip()[:300]

            return {
                "decision": decision,
                "completion_percentage": comp,
                "evidence_quality": quality,
                "criteria_met": c_met,
                "criteria_total": c_total,
                "reasoning": reasoning,
            }

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return _handle_leader_error(leaders_res, leader_fn)

            v_result = leader_fn()
            leader_data = leaders_res.calldata

            if not isinstance(leader_data, dict):
                return False

            # Substantive Consensus Rule 1: Decisions must agree strictly
            if leader_data.get("decision") != v_result.get("decision"):
                return False

            # Substantive Consensus Rule 2: Completion percentage tolerance (within 20 points)
            l_comp = leader_data.get("completion_percentage", 0)
            v_comp = v_result.get("completion_percentage", 0)
            if abs(l_comp - v_comp) > 20:
                return False

            # Substantive Consensus Rule 3: Criteria met consistency
            l_met = leader_data.get("criteria_met", 0)
            v_met = v_result.get("criteria_met", 0)
            if abs(l_met - v_met) > 1:
                return False

            # Do NOT check strict equality on free-form LLM reasoning!
            return True

        # Run non-deterministic consensus
        adjudication = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        # Apply deterministic state transition based on verified consensus
        final_decision = adjudication["decision"]
        m.decision = final_decision
        m.completion_percentage = adjudication["completion_percentage"]
        m.evidence_quality = adjudication["evidence_quality"]
        m.criteria_met = adjudication["criteria_met"]
        m.criteria_total = adjudication["criteria_total"]
        m.concise_reasoning = adjudication["reasoning"]
        m.evaluated_at = "VERIFIED_ON_CHAIN"

        if final_decision == DECISION_PASS:
            m.status = STATUS_PASSED
        elif final_decision == DECISION_FAIL:
            m.status = STATUS_FAILED
        else:
            m.status = STATUS_INCONCLUSIVE

        self.milestones[mkey] = m

    # -------------------------------------------------------------------------
    # Tranche Release & Settlement
    # -------------------------------------------------------------------------
    @gl.public.write
    def release_milestone(self, campaign_id: u256, milestone_id: u256) -> None:
        if campaign_id >= self.campaign_count:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Campaign not found")
        c = self.campaigns[campaign_id]
        if c.status == STATUS_REFUNDED:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Campaign is refunded: milestone tranche cannot be released")
        if milestone_id >= c.milestone_count:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Milestone not found")

        mkey = self._mkey(campaign_id, milestone_id)
        m = self.milestones[mkey]

        if m.status != STATUS_PASSED:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Milestone has not passed adjudication: status is {m.status}")

        if c.released_amount + m.amount > c.funded_amount:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Insufficient escrow balance to release milestone tranche")

        # Advance milestone status to prevent double-release
        m.status = STATUS_RELEASED
        self.milestones[mkey] = m

        c.released_amount += m.amount
        self.campaigns[campaign_id] = c

        # Credit organization claimable ledger
        org_addr = _to_addr(c.organization)
        current_claimable = self.org_claimable.get(org_addr, 0)
        self.org_claimable[org_addr] = current_claimable + m.amount

    # -------------------------------------------------------------------------
    # Donor Refund
    # -------------------------------------------------------------------------
    @gl.public.write
    def refund_campaign(self, campaign_id: u256) -> None:
        sender = _to_addr(gl.message.sender_address)
        if campaign_id >= self.campaign_count:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Campaign not found")
        c = self.campaigns[campaign_id]

        # Post-refund protection: prevent second refund
        if c.status == STATUS_REFUNDED:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Campaign is already refunded")

        # Requirement 4: Require an explicit on-chain refund condition
        # A refund is only valid when at least one milestone has been adjudicated as FAILED
        if not self._has_failed_milestone(campaign_id):
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} Campaign does not meet refund condition: requires an adjudicated failed milestone"
            )

        # Access control: only campaign creator/donor or a contributor who actually funded can trigger refund
        is_donor = (sender == _to_addr(c.donor))
        ckey_sender = f"{campaign_id}_{_addr_hex(sender)}"
        is_contributor = (self.contributions.get(ckey_sender, 0) > 0)
        if not (is_donor or is_contributor):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} Only donor or contributor can trigger refund")

        unreleased = c.funded_amount - c.released_amount - c.refunded_amount
        if unreleased <= 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} No unreleased funds available for refund")

        # Requirement 3: Fix refund ownership. Attribute refunds strictly to actual contributors
        # based on their share of funded escrow. Campaign creator cannot redirect contributor funds.
        num_contributors = self.contributor_counts.get(campaign_id, 0)
        total_funded = c.funded_amount
        allocated: u256 = 0

        for i in range(num_contributors):
            c_addr = self.contributor_addrs[f"{campaign_id}_{i}"]
            ckey = f"{campaign_id}_{_addr_hex(c_addr)}"
            c_contrib = self.contributions.get(ckey, 0)
            if c_contrib > 0:
                if i == num_contributors - 1:
                    # Final contributor receives exact remaining unreleased balance to avoid truncation loss
                    refund_share = unreleased - allocated
                else:
                    refund_share = (c_contrib * unreleased) // total_funded
                    allocated += refund_share

                # Clear contributor record for this campaign to prevent double-refund
                self.contributions[ckey] = 0

                # Credit contributor's personal refund claimable ledger
                curr_claimable = self.donor_claimable.get(c_addr, 0)
                self.donor_claimable[c_addr] = curr_claimable + refund_share

        # Terminal state transition: permanently marks campaign as REFUNDED
        c.refunded_amount += unreleased
        c.status = STATUS_REFUNDED
        self.campaigns[campaign_id] = c

    # -------------------------------------------------------------------------
    # Payout & Refund Claim Execution
    # -------------------------------------------------------------------------
    @gl.public.write
    def claim_payout(self) -> u256:
        sender = _to_addr(gl.message.sender_address)
        amount = self.org_claimable.get(sender, 0)
        if amount == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} No claimable payout balance")

        # Safely zero ledger BEFORE transferring (checks-effects-interactions pattern to prevent reentrancy / double claim)
        self.org_claimable[sender] = 0

        # Transfer exact native GEN amount to caller using supported GenLayer native transfer mechanism
        gl.get_contract_at(sender).emit_transfer(value=amount)

        return amount

    @gl.public.write
    def claim_refund(self) -> u256:
        sender = _to_addr(gl.message.sender_address)
        amount = self.donor_claimable.get(sender, 0)
        if amount == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} No claimable refund balance")

        # Safely zero ledger BEFORE transferring (checks-effects-interactions pattern to prevent double refund)
        self.donor_claimable[sender] = 0

        # Transfer exact native GEN amount to caller using supported GenLayer native transfer mechanism
        gl.get_contract_at(sender).emit_transfer(value=amount)

        return amount
