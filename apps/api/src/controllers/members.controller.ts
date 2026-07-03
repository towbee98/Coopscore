import type { Request, Response } from "express";
import {
  createMemberSchema,
  listMembersQuerySchema,
  paginationQuerySchema,
  simulateContributionSchema,
  updateMemberSchema,
} from "../schemas/members.schema.js";
import { parseOrThrow } from "../lib/validate.js";
import { requireParam } from "../lib/params.js";
import * as membersService from "../services/members.service.js";
import * as reconciliationService from "../services/reconciliation.service.js";

export async function list(req: Request, res: Response): Promise<void> {
  const query = parseOrThrow(listMembersQuerySchema, req.query);
  const result = await membersService.listMembers(req.cooperativeId!, query);
  res.status(200).json({ data: result });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(createMemberSchema, req.body);
  const result = await membersService.createMember(req.cooperativeId!, input);
  res.status(201).json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const result = await membersService.getMemberDetail(req.cooperativeId!, requireParam(req, "id"));
  res.status(200).json(result);
}

export async function update(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(updateMemberSchema, req.body);
  const result = await membersService.updateMember(
    req.cooperativeId!,
    requireParam(req, "id"),
    input,
  );
  res.status(200).json(result);
}

export async function retryProvisioning(req: Request, res: Response): Promise<void> {
  const result = await membersService.retryProvisioning(
    req.cooperativeId!,
    requireParam(req, "id"),
  );
  res.status(200).json(result);
}

export async function listContributions(req: Request, res: Response): Promise<void> {
  const { limit = 50, offset = 0 } = parseOrThrow(paginationQuerySchema, req.query);
  const result = await membersService.listContributions(
    req.cooperativeId!,
    requireParam(req, "id"),
    limit,
    offset,
  );
  res.status(200).json(result);
}

export async function listScoreSnapshots(req: Request, res: Response): Promise<void> {
  const { limit = 20, offset = 0 } = parseOrThrow(paginationQuerySchema, req.query);
  const result = await membersService.listScoreSnapshots(
    req.cooperativeId!,
    requireParam(req, "id"),
    limit,
    offset,
  );
  res.status(200).json(result);
}

export async function listAccountSlips(req: Request, res: Response): Promise<void> {
  const result = await membersService.listAccountSlips(req.cooperativeId!);
  res.status(200).json({ data: result });
}

export async function simulateContribution(req: Request, res: Response): Promise<void> {
  const input = parseOrThrow(simulateContributionSchema, req.body);
  const result = await reconciliationService.recordSimulatedContribution(
    req.cooperativeId!,
    requireParam(req, "id"),
    input.amount,
    input.contributedAt ? new Date(input.contributedAt) : new Date(),
  );
  res.status(200).json({ result });
}
