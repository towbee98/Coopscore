import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiException } from "../lib/api-exception.js";

interface JwtPayload {
  cooperativeId: string;
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new ApiException("UNAUTHORIZED", "Missing or malformed Authorization header", 401);
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.cooperativeId = payload.cooperativeId;
    next();
  } catch {
    throw new ApiException("UNAUTHORIZED", "Invalid or expired token", 401);
  }
}
