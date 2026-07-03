import { and, desc, eq } from "drizzle-orm";
import type { CreateLoanRequest, LoanDecisionRequest, LoanDTO, LoanStatus } from "@coopscore/shared";
import { db } from "../db/client.js";
import { loans, members, recommendations } from "../db/schema.js";
import { ApiException } from "../lib/api-exception.js";
import { logAction } from "./audit.service.js";

function toDTO(row: typeof loans.$inferSelect): LoanDTO {
  return {
    id: row.id,
    memberId: row.memberId,
    recommendationId: row.recommendationId,
    amountRequested: Number(row.amountRequested),
    amountApproved: row.amountApproved === null ? null : Number(row.amountApproved),
    riskTierAtDecision: row.riskTierAtDecision,
    status: row.status,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function getMemberOrThrow(cooperativeId: string, memberId: string) {
  const member = await db.query.members.findFirst({
    where: and(eq(members.id, memberId), eq(members.cooperativeId, cooperativeId)),
  });
  if (!member) {
    throw new ApiException("NOT_FOUND", "Member not found", 404);
  }
  return member;
}

export async function createLoan(
  cooperativeId: string,
  memberId: string,
  input: CreateLoanRequest,
): Promise<LoanDTO> {
  await getMemberOrThrow(cooperativeId, memberId);

  const recommendation = await db.query.recommendations.findFirst({
    where: and(eq(recommendations.id, input.recommendationId), eq(recommendations.memberId, memberId)),
  });
  if (!recommendation) {
    throw new ApiException(
      "STALE_RECOMMENDATION",
      "This recommendation does not belong to the given member",
      400,
    );
  }

  const [loan] = await db
    .insert(loans)
    .values({
      memberId,
      recommendationId: recommendation.id,
      amountRequested: String(input.amountRequested ?? Number(recommendation.recommendedAmount)),
      riskTierAtDecision: recommendation.riskTier,
      status: "pending",
    })
    .returning();

  await logAction(cooperativeId, "loan", loan.id, "created");

  return toDTO(loan);
}

export async function listLoans(
  cooperativeId: string,
  status?: LoanStatus,
): Promise<LoanDTO[]> {
  const conditions = [eq(members.cooperativeId, cooperativeId)];
  if (status) conditions.push(eq(loans.status, status));

  const rows = await db
    .select()
    .from(loans)
    .innerJoin(members, eq(members.id, loans.memberId))
    .where(and(...conditions))
    .orderBy(desc(loans.createdAt));

  return rows.map((row) => toDTO(row.loans));
}

async function getLoanOrThrow(cooperativeId: string, loanId: string) {
  const [row] = await db
    .select()
    .from(loans)
    .innerJoin(members, eq(members.id, loans.memberId))
    .where(and(eq(loans.id, loanId), eq(members.cooperativeId, cooperativeId)))
    .limit(1);

  if (!row) {
    throw new ApiException("NOT_FOUND", "Loan not found", 404);
  }
  return row.loans;
}

export async function getLoan(cooperativeId: string, loanId: string): Promise<LoanDTO> {
  return toDTO(await getLoanOrThrow(cooperativeId, loanId));
}

export async function decideLoan(
  cooperativeId: string,
  loanId: string,
  input: LoanDecisionRequest,
): Promise<LoanDTO> {
  const loan = await getLoanOrThrow(cooperativeId, loanId);

  if (loan.status !== "pending") {
    throw new ApiException(
      "ALREADY_DECIDED",
      "This loan has already been decided and cannot be changed",
      409,
    );
  }

  if (input.decision === "approved" && input.amountApproved === undefined) {
    throw new ApiException("VALIDATION_ERROR", "amountApproved is required when approving", 400);
  }

  const [updated] = await db
    .update(loans)
    .set({
      status: input.decision,
      amountApproved: input.decision === "approved" ? String(input.amountApproved) : null,
      decidedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(loans.id, loanId))
    .returning();

  await logAction(cooperativeId, "loan", loanId, input.decision);

  return toDTO(updated);
}
