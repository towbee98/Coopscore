import { z } from "zod";

export const createMemberSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(1),
  email: z.email().optional(),
  expectedContributionAmount: z.number().positive(),
  contributionFrequency: z.enum(["weekly", "biweekly", "monthly"]),
});

export const updateMemberSchema = z.object({
  status: z.enum(["active", "inactive", "suspended"]).optional(),
  expectedContributionAmount: z.number().positive().optional(),
  contributionFrequency: z.enum(["weekly", "biweekly", "monthly"]).optional(),
});

export const listMembersQuerySchema = z.object({
  status: z.enum(["active", "inactive", "suspended"]).optional(),
  riskTier: z.enum(["low", "medium", "high"]).optional(),
  search: z.string().optional(),
});

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const simulateContributionSchema = z.object({
  amount: z.number().positive(),
  contributedAt: z.iso.datetime().optional(),
});
