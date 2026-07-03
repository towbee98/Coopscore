import type { Request, Response } from "express";
import * as reconciliationService from "../services/reconciliation.service.js";

export async function nomba(req: Request, res: Response): Promise<void> {
  const result = await reconciliationService.reconcileWebhookPayload(req.body);

  // Always 200, including "duplicate" and "unmatched_account" — a non-2xx
  // here would make Nomba retry a webhook that either already succeeded or
  // can't be fixed by retrying. See coopscore-architecture-v1.md §4.2 / §6.
  res.status(200).json({ result });
}
