import { z } from "zod";

export const createLoanSchema = z.object({
  recommendationId: z.uuid(),
  amountRequested: z.number().positive().optional(),
});

export const loanDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  amountApproved: z.number().positive().optional(),
});

export const listLoansQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});
