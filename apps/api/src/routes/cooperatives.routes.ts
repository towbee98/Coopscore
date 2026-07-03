import { Router } from "express";
import * as cooperativesController from "../controllers/cooperatives.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

export const cooperativesRouter = Router();

cooperativesRouter.use(authMiddleware);
cooperativesRouter.get("/me", cooperativesController.getMe);
cooperativesRouter.get("/me/summary", cooperativesController.getSummary);
