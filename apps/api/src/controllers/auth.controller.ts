import type { Request, Response } from "express";
import { loginSchema, signupSchema } from "../schemas/auth.schema.js";
import { parseOrThrow } from "../lib/validate.js";
import * as authService from "../services/auth.service.js";

export async function signup(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(signupSchema, req.body);
  const result = await authService.signup(input);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(loginSchema, req.body);
  const result = await authService.login(input);
  res.status(200).json(result);
}
