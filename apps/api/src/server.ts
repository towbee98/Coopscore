import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { cooperativesRouter } from "./routes/cooperatives.routes.js";
import { membersRouter } from "./routes/members.routes.js";
import { loansRouter } from "./routes/loans.routes.js";
import { webhooksRouter } from "./routes/webhooks.routes.js";
import { docsRouter } from "./routes/docs.routes.js";
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware.js";

const app = express();

app.use(express.json());

app.use("/api/docs", docsRouter);
app.use("/api/auth", authRouter);
app.use("/api/cooperatives", cooperativesRouter);
app.use("/api/members", membersRouter);
app.use("/api/loans", loansRouter);
app.use("/api/webhooks", webhooksRouter);

// Serves apps/web's production build, one Railway service, no CORS to
// manage — see coopscore-architecture-v1.md §7. Skipped when the build
// doesn't exist yet (e.g. running the API alone in local dev, where Vite's
// own dev server + proxy handles the frontend instead).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, "../../web/dist");
if (existsSync(path.join(webDist, "index.html"))) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
}

app.use(notFoundMiddleware);
app.use(errorMiddleware);

app.listen(env.PORT, () => {
  console.warn(`CoopScore API listening on port ${env.PORT}`);
});
