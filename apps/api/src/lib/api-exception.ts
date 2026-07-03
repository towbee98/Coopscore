// Thrown by services/controllers; caught exactly once by error.middleware.ts and
// serialized to the ApiError shape from packages/shared. Nothing else should
// touch res.status().json() for an error path — see coopscore-standards-v1.md.
export class ApiException extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiException";
  }
}
