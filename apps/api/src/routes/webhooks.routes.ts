import { Router } from "express";
import * as webhooksController from "../controllers/webhooks.controller.js";
import { nombaSignatureMiddleware } from "../middleware/nomba-signature.middleware.js";

export const webhooksRouter = Router();

webhooksRouter.post("/nomba", nombaSignatureMiddleware, webhooksController.nomba);
