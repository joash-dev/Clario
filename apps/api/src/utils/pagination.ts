import { HttpError } from "../middleware/errorHandler";

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

/**
 * Defense-in-depth: reject invalid pagination after route Zod parsing.
 */
export function assertPaginationBounds(page: number, limit: number): void {
  if (!Number.isInteger(page) || page < 1) {
    throw new HttpError(400, "page must be an integer >= 1", "VALIDATION_ERROR");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new HttpError(400, "limit must be an integer between 1 and 50", "VALIDATION_ERROR");
  }
}

/** @deprecated Prefer Zod list schemas + assertPaginationBounds; kept for any legacy callers */
export function parsePaginationQuery(query: Record<string, unknown>): { page: number; limit: number } {
  const rawPage = Number.parseInt(String(query.page ?? DEFAULT_PAGE), 10);
  const rawLimit = Number.parseInt(String(query.limit ?? DEFAULT_LIMIT), 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : DEFAULT_PAGE;
  const limitUncapped =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, limitUncapped);

  assertPaginationBounds(page, limit);

  return { page, limit };
}

export function paginationSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}
