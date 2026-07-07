import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Vitest's built-in dist exclusion wasn't kicking in here, so `pnpm
    // build`'s compiled dist/**/*.test.js files were getting picked up
    // alongside the src/**/*.test.ts originals, silently double-running
    // every test. Explicit exclude fixes it.
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
