import type { Request } from "express";
import { ApiException } from "./api-exception.js";

// Express 5's router types req.params[key] as `string | string[]` to allow
// repeated path segments. Our routes never use those, so a param resolving
// to an array indicates a malformed request, not a valid case to handle.
export function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string") {
    throw new ApiException("VALIDATION_ERROR", `Malformed path parameter: ${name}`, 400);
  }
  return value;
}
