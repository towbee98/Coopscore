import type { z } from "zod";
import { ApiException } from "./api-exception.js";

export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiException(
      "VALIDATION_ERROR",
      "Request validation failed",
      400,
      result.error.flatten().fieldErrors,
    );
  }
  return result.data;
}
