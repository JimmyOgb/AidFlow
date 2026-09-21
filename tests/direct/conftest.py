import json
import pytest

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
