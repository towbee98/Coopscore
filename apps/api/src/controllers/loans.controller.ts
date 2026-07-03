import type { Request, Response } from "express";
import { createLoanSchema, listLoansQuerySchema, loanDecisionSchema } from "../schemas/loans.schema.js";
import { parseOrThrow } from "../lib/validate.js";
import { requireParam } from "../lib/params.js";
import * as loansService from "../services/loans.service.js";

export async function createForMember(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(createLoanSchema, req.body);
  const result = await loansService.createLoan(req.cooperativeId!, requireParam(req, "id"), input);
  res.status(201).json(result);
}

export async function list(req: Request, res: Response): Promise<void> {
  const { status } = parseOrThrow(listLoansQuerySchema, req.query);
  const result = await loansService.listLoans(req.cooperativeId!, status);
  res.status(200).json({ data: result });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const result = await loansService.getLoan(req.cooperativeId!, requireParam(req, "id"));
  res.status(200).json(result);
}

export async function decide(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(loanDecisionSchema, req.body);
  const result = await loansService.decideLoan(req.cooperativeId!, requireParam(req, "id"), input);
  res.status(200).json(result);
}
