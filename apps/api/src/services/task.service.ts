import { Priority, TaskStatus } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";
import { assertPaginationBounds, paginationSkip, type PaginationMeta } from "../utils/pagination";

/** Public task fields only (no userId). */
const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const taskOrderBy = [
  { dueAt: { sort: "asc" as const, nulls: "last" as const } },
  { createdAt: "desc" as const },
] as const;

export type TaskDTO = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface CreateTaskInput {
  title: string;
  description?: string;
  dueAt?: Date | null;
  priority?: Priority;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  dueAt?: Date | null;
  priority?: Priority;
  status?: TaskStatus;
}

function notFound(): never {
  throw new HttpError(404, "Task not found", "NOT_FOUND");
}

export async function createTask(userId: string, input: CreateTaskInput): Promise<TaskDTO> {
  const task = await prisma.task.create({
    data: {
      userId,
      title: input.title,
      description: input.description,
      dueAt: input.dueAt ?? undefined,
      priority: input.priority ?? Priority.MEDIUM,
      status: TaskStatus.TODO,
    },
    select: taskSelect,
  });
  return task;
}

export async function listTasks(
  userId: string,
  options: { page: number; limit: number; status?: TaskStatus }
): Promise<{ data: TaskDTO[]; meta: PaginationMeta }> {
  const { page, limit } = options;
  assertPaginationBounds(page, limit);

  const where = {
    userId,
    ...(options.status !== undefined ? { status: options.status } : {}),
  };

  const fetchTake = limit + 1;

  const [total, rows] = await prisma.$transaction([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      select: taskSelect,
      orderBy: [...taskOrderBy],
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

export async function getTaskById(userId: string, taskId: string): Promise<TaskDTO> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: taskSelect,
  });
  if (!task) notFound();
  return task;
}

export async function updateTask(
  userId: string,
  taskId: string,
  patch: UpdateTaskInput
): Promise<TaskDTO> {
  const existing = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: { status: true },
  });
  if (!existing) notFound();

  let completedAt: Date | null | undefined = undefined;
  if (patch.status !== undefined) {
    if (patch.status === TaskStatus.DONE) {
      if (existing.status !== TaskStatus.DONE) {
        completedAt = new Date();
      }
    } else {
      completedAt = null;
    }
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.dueAt !== undefined ? { dueAt: patch.dueAt } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
    },
    select: taskSelect,
  });

  return task;
}

/** Success: 204 via route; not found: throws 404 */
export async function deleteTask(userId: string, taskId: string): Promise<void> {
  const result = await prisma.task.deleteMany({
    where: { id: taskId, userId },
  });
  if (result.count === 0) notFound();
}
