import { Priority, TaskStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../middleware/errorHandler";
import { authenticate } from "../middleware/auth.middleware";
import * as taskService from "../services/task.service";
import { asyncHandler } from "../utils/asyncHandler";
import { assertPaginationBounds } from "../utils/pagination";

const router = Router();

router.use(authenticate);

const idParamSchema = z.object({
  id: z.string().uuid("Invalid task id"),
});

const isoDueAt = z
  .string()
  .min(1, "due_at cannot be empty")
  .refine((s) => !Number.isNaN(Date.parse(s)), {
    message: "due_at must be a valid ISO 8601 date string",
  })
  .transform((s) => new Date(s));

const dueAtOptional = isoDueAt.optional();

const dueAtPatch = z.union([isoDueAt, z.null()]).optional();

const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().optional(),
  due_at: dueAtOptional,
  priority: z.nativeEnum(Priority).optional(),
});

const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().nullable().optional(),
    due_at: dueAtPatch,
    priority: z.nativeEnum(Priority).optional(),
    status: z.nativeEnum(TaskStatus).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "No fields to update" });

const listQuerySchema = z.object({
  page: z.coerce.number().int("page must be an integer").min(1, "page must be an integer >= 1").optional(),
  limit: z.coerce
    .number()
    .int("limit must be an integer")
    .min(1, "limit must be an integer >= 1")
    .max(50, "limit must be <= 50")
    .optional(),
  status: z.nativeEnum(TaskStatus).optional(),
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    if (req.userId === undefined) {
      throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
    }
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION_ERROR");
    }
    const { due_at, ...rest } = parsed.data;
    const task = await taskService.createTask(req.userId, {
      ...rest,
      dueAt: due_at,
    });
    res.status(201).json({ task });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    if (req.userId === undefined) {
      throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
    }
    const q = listQuerySchema.safeParse(req.query);
    if (!q.success) {
      throw new HttpError(400, q.error.issues[0]?.message ?? "Invalid query", "VALIDATION_ERROR");
    }
    const page = q.data.page ?? 1;
    const limit = q.data.limit ?? 10;
    assertPaginationBounds(page, limit);
    const result = await taskService.listTasks(req.userId, {
      page,
      limit,
      status: q.data.status,
    });
    res.status(200).json(result);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (req.userId === undefined) {
      throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
    }
    const params = idParamSchema.safeParse(req.params);
    if (!params.success) {
      throw new HttpError(400, params.error.issues[0]?.message ?? "Invalid id", "VALIDATION_ERROR");
    }
    const task = await taskService.getTaskById(req.userId, params.data.id);
    res.status(200).json({ task });
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    if (req.userId === undefined) {
      throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
    }
    const params = idParamSchema.safeParse(req.params);
    if (!params.success) {
      throw new HttpError(400, params.error.issues[0]?.message ?? "Invalid id", "VALIDATION_ERROR");
    }
    if (req.body === null || typeof req.body !== "object" || Array.isArray(req.body)) {
      throw new HttpError(400, "No fields to update", "VALIDATION_ERROR");
    }
    if (Object.keys(req.body as object).length === 0) {
      throw new HttpError(400, "No fields to update", "VALIDATION_ERROR");
    }
    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION_ERROR");
    }
    const { due_at, ...rest } = parsed.data;
    const patch: taskService.UpdateTaskInput = { ...rest };
    if (due_at !== undefined) {
      patch.dueAt = due_at;
    }
    const task = await taskService.updateTask(req.userId, params.data.id, patch);
    res.status(200).json({ task });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (req.userId === undefined) {
      throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
    }
    const params = idParamSchema.safeParse(req.params);
    if (!params.success) {
      throw new HttpError(400, params.error.issues[0]?.message ?? "Invalid id", "VALIDATION_ERROR");
    }
    await taskService.deleteTask(req.userId, params.data.id);
    res.status(204).send();
  })
);

export { router as taskRouter };
