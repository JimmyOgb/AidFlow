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

export const AIDFLOW_VIEM_ABI = [
  {
    type: "function",
    name: "create_campaign",
    inputs: [
      { name: "organization", type: "address" },
      { name: "title", type: "string" },
      { name: "description", type: "string" },
      { name: "milestone_amounts", type: "uint256[]" },
      { name: "milestone_targets", type: "string[]" },
      { name: "milestone_deadlines", type: "string[]" },
      { name: "milestone_policies", type: "string[]" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "fund_campaign",
    inputs: [{ name: "campaign_id", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "submit_evidence",
    inputs: [
      { name: "campaign_id", type: "uint256" },
      { name: "milestone_id", type: "uint256" },
      { name: "evidence_type", type: "string" },
      { name: "uri", type: "string" },
      { name: "metadata_hash", type: "string" },
      { name: "description", type: "string" },
      { name: "timestamp", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "adjudicate_milestone",
    inputs: [
      { name: "campaign_id", type: "uint256" },
      { name: "milestone_id", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "release_milestone",
    inputs: [
      { name: "campaign_id", type: "uint256" },
      { name: "milestone_id", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "refund_campaign",
    inputs: [{ name: "campaign_id", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claim_payout",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claim_refund",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

