import type { Request, Response } from "express";
import * as cooperativesService from "../services/cooperatives.service.js";

export async function getMe(req: Request, res: Response): Promise<void> {
  const result = await cooperativesService.getCooperative(req.cooperativeId!);
  res.status(200).json(result);
}

export async function getSummary(req: Request, res: Response): Promise<void> {
  const result = await cooperativesService.getSummary(req.cooperativeId!);
  res.status(200).json(result);
}
