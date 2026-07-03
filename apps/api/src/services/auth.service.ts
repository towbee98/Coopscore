import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import type { AuthResponse, LoginRequest, SignupRequest } from "@coopscore/shared";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { cooperatives } from "../db/schema.js";
import { ApiException } from "../lib/api-exception.js";

const BCRYPT_ROUNDS = 10;

function issueToken(cooperativeId: string): string {
  return jwt.sign({ cooperativeId }, env.JWT_SECRET, { expiresIn: "7d" });
}

export async function signup(input: SignupRequest): Promise<AuthResponse> {
  const existing = await db.query.cooperatives.findFirst({
    where: eq(cooperatives.contactEmail, input.contactEmail),
  });
  if (existing) {
    throw new ApiException("EMAIL_TAKEN", "This email is already registered", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const [cooperative] = await db
    .insert(cooperatives)
    .values({
      name: input.name,
      type: input.type,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      passwordHash,
    })
    .returning();

  return {
    token: issueToken(cooperative.id),
    cooperative: {
      id: cooperative.id,
      name: cooperative.name,
      type: cooperative.type,
      contactEmail: cooperative.contactEmail,
      contactPhone: cooperative.contactPhone,
    },
  };
}

export async function login(input: LoginRequest): Promise<AuthResponse> {
  const cooperative = await db.query.cooperatives.findFirst({
    where: eq(cooperatives.contactEmail, input.email),
  });

  // Deliberately identical error for "no such email" and "wrong password" —
  // see coopscore-api-design-v1.md §3.2 (avoids enumerating registered emails).
  if (!cooperative) {
    throw new ApiException("INVALID_CREDENTIALS", "Incorrect email or password", 401);
  }

  const passwordMatches = await bcrypt.compare(input.password, cooperative.passwordHash);
  if (!passwordMatches) {
    throw new ApiException("INVALID_CREDENTIALS", "Incorrect email or password", 401);
  }

  return {
    token: issueToken(cooperative.id),
    cooperative: {
      id: cooperative.id,
      name: cooperative.name,
      type: cooperative.type,
      contactEmail: cooperative.contactEmail,
      contactPhone: cooperative.contactPhone,
    },
  };
}
