import { Router } from "express";
import * as webhooksController from "../controllers/webhooks.controller.js";

export const webhooksRouter = Router();

// TODO: signature verification — exact header/algorithm still unconfirmed
// against real Nomba sandbox docs (coopscore-architecture-v1.md §6). Shipping
// a guessed check would be worse than this explicit gap: anyone who finds
// this URL can currently POST a fake contribution. Acceptable for a hackathon
// build behind an unpublished URL, NOT for anything beyond that.
webhooksRouter.post("/nomba", webhooksController.nomba);
