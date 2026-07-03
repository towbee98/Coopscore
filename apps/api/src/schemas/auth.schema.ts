import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["cooperative", "sacco", "church", "trade_association", "other"]),
  contactEmail: z.email(),
  contactPhone: z.string().min(1),
  password: z.string().min(8, "password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
