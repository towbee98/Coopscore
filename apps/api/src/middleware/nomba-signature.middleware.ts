// Verifies the `nomba-signature` header per developer.nomba.com/docs/api-basics/webhook:
// HMAC-SHA256, base64-encoded, over
// event_type:requestId:userId:walletId:transactionId:type:time:responseCode:timestamp
// (timestamp from the `nomba-timestamp` header), keyed with the dashboard's
// webhook signing key.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { ApiException } from "../lib/api-exception.js";

interface SignedWebhookPayload {
  event_type?: string;
  requestId?: string;
  data?: {
    merchant?: { userId?: string; walletId?: string };
    transaction?: {
      transactionId?: string;
      type?: string;
      time?: string;
      responseCode?: string | null;
    };
  };
}

export function nombaSignatureMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!env.NOMBA_SIGNATURE_KEY) {
    throw new ApiException("PROVISIONING_FAILED", "NOMBA_SIGNATURE_KEY is not configured", 500);
  }

  const signature = req.header("nomba-signature");
  const timestamp = req.header("nomba-timestamp");
  if (!signature || !timestamp) {
    throw new ApiException("UNAUTHORIZED", "Missing nomba-signature or nomba-timestamp header", 401);
  }

  const body = req.body as SignedWebhookPayload;
  const fields = [
    body.event_type,
    body.requestId,
    body.data?.merchant?.userId,
    body.data?.merchant?.walletId,
    body.data?.transaction?.transactionId,
    body.data?.transaction?.type,
    body.data?.transaction?.time,
    body.data?.transaction?.responseCode ?? "",
  ].map((field) => field ?? "");

  const signedString = [...fields, timestamp].join(":");
  const expected = createHmac("sha256", env.NOMBA_SIGNATURE_KEY).update(signedString).digest("base64");

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);
  const isValid =
    expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);

  if (!isValid) {
    throw new ApiException("UNAUTHORIZED", "Invalid webhook signature", 401);
  }

  next();
}
