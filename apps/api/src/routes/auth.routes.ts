import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../middleware/errorHandler";
import * as authService from "../services/auth.service";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

const credentialsSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const registerSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
});

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Invalid input";
      throw new HttpError(400, first, "VALIDATION_ERROR");
    }

    const { user } = await authService.register(parsed.data);
    res.status(201).json({ user });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Invalid input";
      throw new HttpError(400, first, "VALIDATION_ERROR");
    }

    const result = await authService.login(parsed.data);
    res.status(200).json(result);
  })
);

export { router as authRouter };
