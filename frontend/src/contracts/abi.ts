export const AIDFLOW_ABI = {
  contract: "AidFlow",
  methods: {
    create_campaign: {
      params: [
        { name: "organization", type: "address" },
        { name: "title", type: "string" },
        { name: "description", type: "string" },
        { name: "milestone_amounts", type: "int[]" },
        { name: "milestone_targets", type: "string[]" },
        { name: "milestone_deadlines", type: "string[]" },
        { name: "milestone_policies", type: "string[]" }
      ],
      readonly: false,
      ret: "int",
      payable: false
    },
    fund_campaign: {
      params: [{ name: "campaign_id", type: "int" }],
      readonly: false,
      ret: "null",
      payable: true
    },
    submit_evidence: {
      params: [
        { name: "campaign_id", type: "int" },
        { name: "milestone_id", type: "int" },
        { name: "evidence_type", type: "string" },
        { name: "uri", type: "string" },
        { name: "metadata_hash", type: "string" },
        { name: "description", type: "string" },
        { name: "timestamp", type: "string" }
      ],
      readonly: false,
      ret: "null",
      payable: false
    },
    adjudicate_milestone: {
      params: [
        { name: "campaign_id", type: "int" },
        { name: "milestone_id", type: "int" }
      ],
      readonly: false,
      ret: "null",
      payable: false
    },
    release_milestone: {
      params: [
        { name: "campaign_id", type: "int" },
        { name: "milestone_id", type: "int" }
      ],
      readonly: false,
      ret: "null",
      payable: false
    },
    refund_campaign: {
      params: [{ name: "campaign_id", type: "int" }],
      readonly: false,
      ret: "null",
      payable: false
    },
    claim_payout: {
      params: [],
      readonly: false,
      ret: "int",
      payable: false
    },
    claim_refund: {
      params: [],
      readonly: false,
      ret: "int",
      payable: false
    },
    get_campaign_count: {
      params: [],
      readonly: true,
      ret: "int"
    },
    get_campaign: {
      params: [{ name: "campaign_id", type: "int" }],
      readonly: true,
      ret: "dict"
    },
    get_milestone: {
      params: [
        { name: "campaign_id", type: "int" },
        { name: "milestone_id", type: "int" }
      ],
      readonly: true,
      ret: "dict"
    },
    get_campaign_milestones: {
      params: [{ name: "campaign_id", type: "int" }],
      readonly: true,
      ret: "array"
    },
    get_milestone_evidence: {
      params: [
        { name: "campaign_id", type: "int" },
        { name: "milestone_id", type: "int" },
        { name: "evidence_idx", type: "int" }
      ],
      readonly: true,
      ret: "dict"
    },
    get_claimable_balances: {
      params: [{ name: "account", type: "address" }],
      readonly: true,
      ret: "dict"
    }
  }
} as const;
