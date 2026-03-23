import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../middleware/errorHandler";
import { authenticate } from "../middleware/auth.middleware";
import * as noteService from "../services/note.service";
import { asyncHandler } from "../utils/asyncHandler";
import { assertPaginationBounds } from "../utils/pagination";

const router = Router();

router.use(authenticate);

const idParamSchema = z.object({
  id: z.string().uuid("Invalid note id"),
});

const createNoteSchema = z.object({
  content: z.string().min(1, "Content is required"),
  title: z.union([z.string().max(500), z.null()]).optional(),
});

const updateNoteSchema = z
  .object({
    title: z.string().max(500).nullable().optional(),
    content: z.string().min(1).optional(),
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
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    if (req.userId === undefined) {
      throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
    }
    const parsed = createNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION_ERROR");
    }
    const note = await noteService.createNote(req.userId, parsed.data);
    res.status(201).json({ note });
  })
);

router.post(
  "/:id/summarize",
  asyncHandler(async (req, res) => {
    if (req.userId === undefined) {
      throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
    }
    const params = idParamSchema.safeParse(req.params);
    if (!params.success) {
      throw new HttpError(400, params.error.issues[0]?.message ?? "Invalid id", "VALIDATION_ERROR");
    }
    const result = await noteService.summarizeNoteForUser(req.userId, params.data.id);
    res.status(200).json(result);
  })
);

router.post(
  "/:id/tasks",
  asyncHandler(async (req, res) => {
    if (req.userId === undefined) {
      throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
    }
    const params = idParamSchema.safeParse(req.params);
    if (!params.success) {
      throw new HttpError(400, params.error.issues[0]?.message ?? "Invalid id", "VALIDATION_ERROR");
    }
    const result = await noteService.suggestTasksFromNote(req.userId, params.data.id);
    res.status(200).json(result);
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
    const result = await noteService.listNotes(req.userId, { page, limit });
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
    const note = await noteService.getNoteById(req.userId, params.data.id);
    res.status(200).json({ note });
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
    const parsed = updateNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input", "VALIDATION_ERROR");
    }
    const note = await noteService.updateNote(req.userId, params.data.id, parsed.data);
    res.status(200).json({ note });
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
    await noteService.deleteNote(req.userId, params.data.id);
    res.status(204).send();
  })
);

export { router as noteRouter };
