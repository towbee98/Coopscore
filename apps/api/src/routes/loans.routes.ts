import { Router } from "express";
import * as loansController from "../controllers/loans.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

export const loansRouter = Router();

loansRouter.use(authMiddleware);
loansRouter.get("/", loansController.list);
loansRouter.get("/:id", loansController.getById);
loansRouter.patch("/:id/decision", loansController.decide);
