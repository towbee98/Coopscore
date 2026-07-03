// Augments Express's Request with the tenant id attached by auth.middleware.ts.
// Every service function takes cooperativeId explicitly (see coopscore-architecture-v1.md §5) —
// this augmentation only exists so controllers can read it off req without a cast.
export {};

declare global {
  namespace Express {
    interface Request {
      cooperativeId?: string;
    }
  }
}
