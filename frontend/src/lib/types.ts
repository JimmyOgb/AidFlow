export type EvidenceType =
  | "RECEIPT"
  | "DELIVERY_RECORD"
  | "PHOTO"
  | "GEOGRAPHIC"
  | "BENEFICIARY_CONFIRMATION"
  | "ORG_REPORT"
  | "WEB_EVIDENCE";

export type MilestoneStatus =
  | "DRAFT"
  | "FUNDED"
  | "ACTIVE"
  | "EVIDENCE_SUBMITTED"
  | "ADJUDICATING"
  | "PASSED"
  | "FAILED"
  | "INCONCLUSIVE"
  | "RELEASED"
  | "REFUNDED";

export type AdjudicationDecision = "PENDING" | "PASS" | "FAIL" | "INCONCLUSIVE";

export interface EvidenceRef {
  evidence_type: EvidenceType;
  uri: string;
  metadata_hash: string;
  description: string;
  submitted_at: string;
}

export interface AdjudicationResult {
  decision: AdjudicationDecision;
  completion_percentage: number;
  evidence_quality: string;
  criteria_met: number;
  criteria_total: number;
  concise_reasoning: string;
  evaluated_at: string;
}

export interface Milestone {
  id: number;
  amount: bigint | number;
  target: string;
  deadline: string;
  verification_policy: string;
  status: MilestoneStatus;
  evidence_count: number;
  adjudication: AdjudicationResult;
}

export interface Campaign {
  id: number;
  donor: string;
  organization: string;
  title: string;
  description: string;
  total_funding: bigint | number;
  funded_amount: bigint | number;
  released_amount: bigint | number;
  refunded_amount: bigint | number;
  status: string;
  created_at?: string;
  milestone_count: number;
}
