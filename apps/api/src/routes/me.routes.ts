import { Router } from "express";
import { HttpError } from "../middleware/errorHandler";
import { authenticate } from "../middleware/auth.middleware";
import * as authService from "../services/auth.service";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get(
  "/",
  authenticate,
  asyncHandler(async (req, res) => {
    if (req.userId === undefined) {
      throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
    }
    const user = await authService.getUserById(req.userId);
    res.status(200).json({ user });
  })
);

export { router as meRouter };
