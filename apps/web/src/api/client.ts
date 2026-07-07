import type {
  AccountSlipDTO,
  ApiError,
  AuthResponse,
  ContributionDTO,
  CooperativeDTO,
  CooperativeSummary,
  CreateLoanRequest,
  CreateMemberRequest,
  ListResponse,
  LoanDecisionRequest,
  LoanDTO,
  LoanStatus,
  LoginRequest,
  MemberDetail,
  MemberStatus,
  MemberSummary,
  PaginatedListResponse,
  RecommendationDTO,
  RiskTier,
  ScoreSnapshotDTO,
  SignupRequest,
  SimulateContributionRequest,
  UpdateMemberRequest,
} from "@coopscore/shared";
import { clearSession, getToken } from "../lib/auth.ts";

// Empty by default — relative "/api/..." works when the frontend is served
// same-origin from apps/api (the documented single-service Railway setup).
// Set VITE_API_URL at build time only when deploying apps/web as a separate
// service, pointed at the API's own origin (e.g. https://coopscore-production.up.railway.app).
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    clearSession();
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new ApiClientError("UNAUTHORIZED", "Session expired — please log in again", 401);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiClientError(
      body?.error.code ?? "UNKNOWN_ERROR",
      body?.error.message ?? "Something went wrong",
      response.status,
      body?.error.details,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function query(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string | number][];
  if (entries.length === 0) return "";
  return `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}`;
}

export const api = {
  // --- Auth ---
  signup: (body: SignupRequest) => request<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify(body) }),
  login: (body: LoginRequest) => request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) }),

  // --- Cooperative ---
  getCooperative: () => request<CooperativeDTO>("/cooperatives/me"),
  getSummary: () => request<CooperativeSummary>("/cooperatives/me/summary"),

  // --- Members ---
  listMembers: (filters: { status?: MemberStatus; riskTier?: RiskTier; search?: string } = {}) =>
    request<ListResponse<MemberSummary>>(`/members${query(filters)}`),
  createMember: (body: CreateMemberRequest) =>
    request<MemberDetail>("/members", { method: "POST", body: JSON.stringify(body) }),
  getMember: (id: string) => request<MemberDetail>(`/members/${id}`),
  updateMember: (id: string, body: UpdateMemberRequest) =>
    request<MemberDetail>(`/members/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  retryProvisioning: (id: string) => request<MemberDetail>(`/members/${id}/provision`, { method: "POST" }),
  listContributions: (id: string, limit = 50, offset = 0) =>
    request<PaginatedListResponse<ContributionDTO>>(`/members/${id}/contributions${query({ limit, offset })}`),
  listScoreSnapshots: (id: string, limit = 20, offset = 0) =>
    request<PaginatedListResponse<ScoreSnapshotDTO>>(`/members/${id}/score-snapshots${query({ limit, offset })}`),
  createRecommendation: (id: string) =>
    request<RecommendationDTO>(`/members/${id}/recommendations`, { method: "POST" }),
  listRecommendations: (id: string) => request<ListResponse<RecommendationDTO>>(`/members/${id}/recommendations`),
  createLoan: (id: string, body: CreateLoanRequest) =>
    request<LoanDTO>(`/members/${id}/loans`, { method: "POST", body: JSON.stringify(body) }),
  simulateContribution: (id: string, body: SimulateContributionRequest) =>
    request<{ result: string }>(`/members/${id}/simulate-contribution`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listAccountSlips: () => request<ListResponse<AccountSlipDTO>>("/members/account-slips"),

  // --- Loans ---
  listLoans: (status?: LoanStatus) => request<ListResponse<LoanDTO>>(`/loans${query({ status })}`),
  getLoan: (id: string) => request<LoanDTO>(`/loans/${id}`),
  decideLoan: (id: string, body: LoanDecisionRequest) =>
    request<LoanDTO>(`/loans/${id}/decision`, { method: "PATCH", body: JSON.stringify(body) }),
};
