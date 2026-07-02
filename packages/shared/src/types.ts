// Mirrors the Postgres enums defined in apps/api/src/db/schema.ts.
// Kept here (not re-exported from the Drizzle schema) so apps/web can import
// these without pulling in drizzle-orm/pg as a dependency.

export type CoopType = "cooperative" | "sacco" | "church" | "trade_association" | "other";

export type Frequency = "weekly" | "biweekly" | "monthly";

export type MemberStatus = "active" | "inactive" | "suspended";

export type AccountStatus = "active" | "suspended";

export type TrendDirection = "improving" | "stable" | "declining";

export type RiskTier = "low" | "medium" | "high";

export type LoanStatus = "pending" | "approved" | "rejected";

export interface MemberSummary {
  id: string;
  fullName: string;
  status: MemberStatus;
  riskTier: RiskTier | null;
  monthsActive: number | null;
  lastContributionAt: string | null;
}

export interface CooperativeSummary {
  totalMembers: number;
  totalCollectedThisMonth: number;
  activeLoans: number;
  membersByRiskTier: Record<RiskTier, number>;
}

export interface ScoreSnapshotDTO {
  id: string;
  memberId: string;
  consistencyPct: number;
  monthsActive: number;
  missedPaymentsCount: number;
  averageContribution: number;
  trend: TrendDirection;
  riskTier: RiskTier;
  recommendedLoanAmount: number;
  computedAt: string;
}

export interface RecommendationDTO {
  id: string;
  memberId: string;
  scoreSnapshotId: string;
  riskTier: RiskTier;
  recommendedAmount: number;
  llmExplanation: string | null;
  generatedAt: string;
}

export interface VirtualAccountDTO {
  id: string;
  accountNumber: string;
  bankName: string;
  status: AccountStatus;
}

export interface ContributionDTO {
  id: string;
  amount: number;
  contributedAt: string;
  periodStart: string;
  periodEnd: string;
  isLate: boolean;
}

export interface LoanDTO {
  id: string;
  memberId: string;
  recommendationId: string | null;
  amountRequested: number;
  amountApproved: number | null;
  riskTierAtDecision: RiskTier;
  status: LoanStatus;
  decidedAt: string | null;
  createdAt: string;
}

export interface MemberDetail extends MemberSummary {
  phone: string;
  email: string | null;
  expectedContributionAmount: number;
  contributionFrequency: Frequency;
  virtualAccount: VirtualAccountDTO | null;
  latestScore: ScoreSnapshotDTO | null;
}

export interface CooperativeDTO {
  id: string;
  name: string;
  type: CoopType;
  contactEmail: string;
  contactPhone: string;
}

// --- Auth ---

export interface SignupRequest {
  name: string;
  type: CoopType;
  contactEmail: string;
  contactPhone: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  cooperative: CooperativeDTO;
}

// --- Members ---

export interface CreateMemberRequest {
  fullName: string;
  phone: string;
  email?: string;
  expectedContributionAmount: number;
  contributionFrequency: Frequency;
}

export interface UpdateMemberRequest {
  status?: MemberStatus;
  expectedContributionAmount?: number;
  contributionFrequency?: Frequency;
}

// FR8 — Account Details Distribution. Deliberately narrower than MemberDetail:
// just what a printed/shared account slip needs, for members with a provisioned account.
export interface AccountSlipDTO {
  memberId: string;
  fullName: string;
  phone: string;
  accountNumber: string;
  bankName: string;
  cooperativeName: string;
}

// --- Loans ---

export interface CreateLoanRequest {
  recommendationId: string;
  amountRequested?: number;
}

export interface LoanDecisionRequest {
  decision: "approved" | "rejected";
  amountApproved?: number;
}

// --- Envelopes ---

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ListResponse<T> {
  data: T[];
}

export interface PaginatedListResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}
