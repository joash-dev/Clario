import type { ErrorRequestHandler } from "express";

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Central error handler — maps known errors to JSON; avoids leaking stack traces in production.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const statusCode = err instanceof HttpError ? err.statusCode : 500;
  const code = err instanceof HttpError ? err.code : "INTERNAL_ERROR";
  const message =
    statusCode === 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error";

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    error: {
      message,
      ...(code && { code }),
      ...(process.env.NODE_ENV !== "production" && err instanceof Error && err.stack
        ? { stack: err.stack }
        : {}),
    },
  });
};
