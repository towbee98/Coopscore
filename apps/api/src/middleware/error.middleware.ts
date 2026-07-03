import type { ErrorRequestHandler, RequestHandler } from "express";
import type { ApiError } from "@coopscore/shared";
import { ApiException } from "../lib/api-exception.js";

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiException) {
    const body: ApiError = {
      error: { code: err.code, message: err.message, details: err.details },
    };
    res.status(err.status).json(body);
    return;
  }

  console.error(err);
  const body: ApiError = {
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
  };
  res.status(500).json(body);
};

export const notFoundMiddleware: RequestHandler = (_req, res) => {
  const body: ApiError = {
    error: { code: "NOT_FOUND", message: "Route not found" },
  };
  res.status(404).json(body);
};
