import { Router } from "express";
import * as membersController from "../controllers/members.controller.js";
import * as recommendationsController from "../controllers/recommendations.controller.js";
import * as loansController from "../controllers/loans.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

export const membersRouter = Router();

membersRouter.use(authMiddleware);

// Static path before the /:id param routes, so it isn't swallowed as an id.
membersRouter.get("/account-slips", membersController.listAccountSlips);

membersRouter.get("/", membersController.list);
membersRouter.post("/", membersController.create);
membersRouter.get("/:id", membersController.getById);
membersRouter.patch("/:id", membersController.update);
membersRouter.post("/:id/provision", membersController.retryProvisioning);
membersRouter.get("/:id/contributions", membersController.listContributions);
membersRouter.get("/:id/score-snapshots", membersController.listScoreSnapshots);
membersRouter.post("/:id/recommendations", recommendationsController.create);
membersRouter.get("/:id/recommendations", recommendationsController.list);
membersRouter.post("/:id/loans", loansController.createForMember);
membersRouter.post("/:id/simulate-contribution", membersController.simulateContribution);
