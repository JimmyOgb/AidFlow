// GenLayer Intelligent Contract ABI for AidFlow
// Verified against contracts/aidflow.py

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
      ret: "null",
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
        { name: "submitted_at", type: "string" }
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
    },
    is_campaign_refundable: {
      params: [{ name: "campaign_id", type: "int" }],
      readonly: true,
      ret: "bool"
    },
    get_contributor_amount: {
      params: [
        { name: "campaign_id", type: "int" },
        { name: "contributor", type: "address" }
      ],
      readonly: true,
      ret: "int"
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
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "fund_campaign",
    inputs: [{ name: "campaign_id", type: "uint256" }],
    outputs: [],
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
      { name: "submitted_at", type: "string" },
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
  {
    type: "function",
    name: "get_campaign_count",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "get_campaign",
    inputs: [{ name: "campaign_id", type: "uint256" }],
    outputs: [
      {
        components: [
          { name: "id", type: "uint256" },
          { name: "donor", type: "address" },
          { name: "organization", type: "address" },
          { name: "title", type: "string" },
          { name: "description", type: "string" },
          { name: "total_funding", type: "uint256" },
          { name: "funded_amount", type: "uint256" },
          { name: "released_amount", type: "uint256" },
          { name: "refunded_amount", type: "uint256" },
          { name: "status", type: "string" },
          { name: "milestone_count", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "get_milestone",
    inputs: [
      { name: "campaign_id", type: "uint256" },
      { name: "milestone_id", type: "uint256" },
    ],
    outputs: [
      {
        components: [
          { name: "id", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "target", type: "string" },
          { name: "deadline", type: "string" },
          { name: "verification_policy", type: "string" },
          { name: "status", type: "string" },
          { name: "evidence_count", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "get_campaign_milestones",
    inputs: [{ name: "campaign_id", type: "uint256" }],
    outputs: [{ name: "", type: "tuple[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "get_milestone_evidence",
    inputs: [
      { name: "campaign_id", type: "uint256" },
      { name: "milestone_id", type: "uint256" },
      { name: "evidence_idx", type: "uint256" },
    ],
    outputs: [
      {
        components: [
          { name: "evidence_type", type: "string" },
          { name: "uri", type: "string" },
          { name: "metadata_hash", type: "string" },
          { name: "description", type: "string" },
          { name: "submitted_at", type: "string" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "get_claimable_balances",
    inputs: [{ name: "account", type: "address" }],
    outputs: [
      {
        components: [
          { name: "org_claimable", type: "uint256" },
          { name: "donor_claimable", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "is_campaign_refundable",
    inputs: [{ name: "campaign_id", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "get_contributor_amount",
    inputs: [
      { name: "campaign_id", type: "uint256" },
      { name: "contributor", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;
