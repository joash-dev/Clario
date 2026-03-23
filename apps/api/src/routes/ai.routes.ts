import { Router } from "express";
import { z } from "zod";
import { chat as chatController } from "../controllers/ai.controller";
import { HttpError } from "../middleware/errorHandler";
import { authenticate } from "../middleware/auth.middleware";
import * as aiService from "../services/ai.service";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

const textBodySchema = z.object({
  text: z.string().min(1, "text is required").max(50_000, "text is too long"),
});

router.post(
  "/summarize",
  asyncHandler(async (req, res) => {
    if (req.userId === undefined) {
      throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
    }
    const parsed = textBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION_ERROR");
    }
    const summary = await aiService.summarizeText(parsed.data.text);
    res.status(200).json({ summary });
  })
);

router.post(
  "/suggest-tasks",
  asyncHandler(async (req, res) => {
    if (req.userId === undefined) {
      throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
    }
    const parsed = textBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION_ERROR");
    }
    const suggestions = await aiService.suggestTasks(parsed.data.text);
    res.status(200).json({ suggestions });
  })
);

router.post("/chat", asyncHandler(chatController));

export { router as aiRouter };
