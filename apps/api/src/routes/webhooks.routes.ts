import { Router } from "express";
import * as webhooksController from "../controllers/webhooks.controller.js";

export const webhooksRouter = Router();

// TODO: signature verification. Confirmed so far (developer.nomba.com/products/webhooks/signature-verification-new,
// via search cache — the page itself 404s on direct fetch as of 2026-07):
// HMAC-SHA256 over event_type, requestId, data.merchant.userId,
// data.merchant.walletId, data.transaction.transactionId, data.transaction.type,
// data.transaction.time, data.transaction.responseCode, each joined by ":",
// with a timestamp appended the same way, keyed with the dashboard's
// Signature Key. NOT yet confirmed: which header carries the signature (and
// which carries the timestamp) — get that from a real test webhook delivery
// in the Nomba dashboard, not a guess. Shipping a guessed header check would
// be worse than this explicit gap: anyone who finds this URL can currently
// POST a fake contribution. Acceptable for a hackathon build behind an
// unpublished URL, NOT for anything beyond that.
webhooksRouter.post("/nomba", webhooksController.nomba);
