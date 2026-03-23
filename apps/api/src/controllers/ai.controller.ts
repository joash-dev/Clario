import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import * as aiService from "../services/ai.service";

const chatBodySchema = z.object({
  message: z.string().min(1, "message is required").max(5000, "message is too long"),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(20_000),
      })
    )
    .max(40)
    .default([]),
});

export async function chat(req: Request, res: Response): Promise<void> {
  if (req.userId === undefined) {
    throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
  }

  const parsed = chatBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION_ERROR");
  }

  const { message, conversationHistory } = parsed.data;
  const userId = req.userId;

  const tasks = await prisma.task.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const notes = await prisma.note.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const context = { tasks, notes };

  try {
    const reply = await aiService.chat(message, conversationHistory, context);
    res.status(200).json({ reply });
  } catch (error) {
    console.error("Chat error:", error);
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(503, "AI service unavailable", "AI_UNAVAILABLE");
  }
}
