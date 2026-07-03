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

// TODO: once apps/web has a production build, serve it here as the catch-all
// (per coopscore-architecture-v1.md §7) — same Railway service, no CORS to manage.

app.use(notFoundMiddleware);
app.use(errorMiddleware);

app.listen(env.PORT, () => {
  console.warn(`CoopScore API listening on port ${env.PORT}`);
});
