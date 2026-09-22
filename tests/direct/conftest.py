import os
from pathlib import Path

# Use local prebuilt/extracted GenVM trees if available to avoid re-downloading from GitHub
_candidate_trees = Path.home() / ".cache" / "gltest-direct" / "trees-v2"
if _candidate_trees.exists():
    for _sub in _candidate_trees.glob("*"):
        if (_sub / ".extracted").exists() or (_sub / "runners").exists():
            os.environ.setdefault("GENVM_PREBUILT_DIR", str(_sub))
            break

import json
import pytest
from gltest.direct.loader import deploy_contract


@pytest.fixture(autouse=True)
def setup_transfer_hook(direct_vm):
    """Auto-install cross-contract message hook to track native GEN balance transfers."""
    def transfer_hook(vm, req):
        if "PostMessage" in req:
            val = int(req["PostMessage"].get("value", 0))
            if val > 0:
                tgt = vm._to_bytes(req["PostMessage"]["address"])
                src = vm._to_bytes(vm._contract_address)
                vm._balances[src] = vm._balances.get(src, 0) - val
                vm._balances[tgt] = vm._balances.get(tgt, 0) + val
            return {"ok": None}
        return None
    direct_vm._gl_call_hook = transfer_hook


@pytest.fixture
def direct_deploy(direct_vm):
    """Deploy contract and wire up automatic escrow native balance tracking upon funding."""
    def _deploy(contract_path, *args, **kwargs):
        path = Path(contract_path)
        if not path.is_absolute():
            if not path.exists():
                for base in [Path.cwd(), Path.cwd() / "contracts"]:
                    candidate = base / contract_path
                    if candidate.exists():
                        path = candidate.resolve()
                        break
            else:
                path = path.resolve()
        contract = deploy_contract(path, direct_vm, *args, **kwargs)

        orig_fund = contract.fund_campaign
        def _fund_with_balance(campaign_id, *f_args, **f_kwargs):
            val = direct_vm.value
            if val > 0:
                s_bytes = direct_vm._to_bytes(direct_vm.sender)
                c_bytes = direct_vm._to_bytes(direct_vm._contract_address)
                direct_vm._balances[s_bytes] = direct_vm._balances.get(s_bytes, 0) - val
                direct_vm._balances[c_bytes] = direct_vm._balances.get(c_bytes, 0) + val
            return orig_fund(campaign_id, *f_args, **f_kwargs)
        contract.fund_campaign = _fund_with_balance
        return contract
    return _deploy


@pytest.fixture
def sample_campaign_args(direct_bob):
    # Bob acts as the local humanitarian organization
    return {
        "organization": direct_bob,
        "title": "Community Food Relief",
        "description": "Provide 50 food packages to households in a specified community.",
        "milestone_amounts": [30 * 10**18, 50 * 10**18, 20 * 10**18],
        "milestone_targets": [
            "Purchase 50 food packages — 30 GEN",
            "Distribute 50 packages — 50 GEN",
            "Submit beneficiary confirmation — 20 GEN",
        ],
        "milestone_deadlines": [
            "2026-10-01T00:00:00Z",
            "2026-10-15T00:00:00Z",
            "2026-10-30T00:00:00Z",
        ],
        "milestone_policies": [
            "Require purchase receipt with itemized inventory and total matching package count.",
            "Require delivery records, distribution logs, and on-site geotagged photographs.",
            "Require at least 10 signed or digital beneficiary confirmations from verified recipients.",
        ],
    }
