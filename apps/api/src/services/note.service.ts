import { env } from "../config/env";
import { HttpError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";
import * as aiService from "./ai.service";
import { assertPaginationBounds, paginationSkip, type PaginationMeta } from "../utils/pagination";

/** Public note fields only (no userId, no AI metadata). */
const noteSelect = {
  id: true,
  title: true,
  content: true,
  summary: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type NoteDTO = {
  id: string;
  title: string | null;
  content: string;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface CreateNoteInput {
  content: string;
  title?: string | null;
}

export interface UpdateNoteInput {
  title?: string | null;
  content?: string;
}

function notFound(): never {
  throw new HttpError(404, "Note not found", "NOT_FOUND");
}

export async function createNote(userId: string, input: CreateNoteInput): Promise<NoteDTO> {
  const note = await prisma.note.create({
    data: {
      userId,
      content: input.content,
      title: input.title ?? undefined,
    },
    select: noteSelect,
  });
  return note;
}

export async function listNotes(
  userId: string,
  options: { page: number; limit: number }
): Promise<{ data: NoteDTO[]; meta: PaginationMeta }> {
  const { page, limit } = options;
  assertPaginationBounds(page, limit);

  const where = { userId };
  const fetchTake = limit + 1;

  const [total, rows] = await prisma.$transaction([
    prisma.note.count({ where }),
    prisma.note.findMany({
      where,
      select: noteSelect,
      orderBy: { updatedAt: "desc" },
      skip: paginationSkip(page, limit),
      take: fetchTake,
    }),
  ]);

  const hasNextPage = rows.length > limit;
  const data = hasNextPage ? rows.slice(0, limit) : rows;
  void hasNextPage;

  return {
    data,
    meta: { page, limit, total },
  };
}

export async function getNoteById(userId: string, noteId: string): Promise<NoteDTO> {
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId },
    select: noteSelect,
  });
  if (!note) notFound();
  return note;
}

export async function updateNote(
  userId: string,
  noteId: string,
  patch: UpdateNoteInput
): Promise<NoteDTO> {
  const existing = await prisma.note.findFirst({
    where: { id: noteId, userId },
    select: { id: true },
  });
  if (!existing) notFound();

  const note = await prisma.note.update({
    where: { id: noteId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.content !== undefined ? { content: patch.content } : {}),
    },
    select: noteSelect,
  });

  return note;
}

/** Success: 204 via route; not found: throws 404 */
export async function deleteNote(userId: string, noteId: string): Promise<void> {
  const result = await prisma.note.deleteMany({
    where: { id: noteId, userId },
  });
  if (result.count === 0) notFound();
}

export async function summarizeNoteForUser(userId: string, noteId: string): Promise<{ summary: string }> {
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId },
    select: { id: true, content: true },
  });
  if (!note) notFound();

  const summary = await aiService.summarizeText(note.content);

  await prisma.note.update({
    where: { id: noteId },
    data: {
      summary,
      summaryModel: env.AI_PROVIDER === "gemini" ? env.GEMINI_MODEL : env.OPENAI_MODEL,
      summaryUpdatedAt: new Date(),
    },
  });

  return { summary };
}
