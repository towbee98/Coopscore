import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  PORT: z.coerce.number().int().positive().default(4000),
  NOMBA_BASE_URL: z.string().default("https://sandbox.nomba.com"),
  NOMBA_ACCOUNT_ID: z.string().optional(),
  NOMBA_CLIENT_ID: z.string().optional(),
  NOMBA_CLIENT_SECRET: z.string().optional(),
  NOMBA_SIGNATURE_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  // Only needed when apps/web is deployed as a separate Railway service from
  // apps/api — set to that service's public URL. Unset in the default
  // single-service setup, where the frontend is served same-origin and CORS
  // isn't needed at all.
  CORS_ORIGIN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Environment validation failed — see above for details");
}

export const env = parsed.data;
