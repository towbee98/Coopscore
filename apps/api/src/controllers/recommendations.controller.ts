import type { Request, Response } from "express";
import { requireParam } from "../lib/params.js";
import * as recommendationService from "../services/recommendation.service.js";

export async function create(req: Request, res: Response): Promise<void> {
  const result = await recommendationService.createRecommendation(
    req.cooperativeId!,
    requireParam(req, "id"),
  );
  res.status(201).json(result);
}

export async function list(req: Request, res: Response): Promise<void> {
  const result = await recommendationService.listRecommendations(
    req.cooperativeId!,
    requireParam(req, "id"),
  );
  res.status(200).json({ data: result });
}
