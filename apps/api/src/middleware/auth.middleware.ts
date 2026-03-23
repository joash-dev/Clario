import type { NextFunction, Request, RequestHandler, Response } from "express";
import { HttpError } from "./errorHandler";
import { verifyAccessToken } from "../services/auth.service";

const BEARER_PREFIX = "Bearer ";

export const authenticate: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization;

  if (header === undefined || typeof header !== "string") {
    next(new HttpError(401, "Unauthorized", "UNAUTHORIZED"));
    return;
  }

  if (!header.startsWith(BEARER_PREFIX)) {
    next(new HttpError(401, "Unauthorized", "UNAUTHORIZED"));
    return;
  }

  const raw = header.slice(BEARER_PREFIX.length);
  const token = raw.trim();
  if (token.length === 0) {
    next(new HttpError(401, "Unauthorized", "UNAUTHORIZED"));
    return;
  }

  try {
    const { userId } = verifyAccessToken(token);
    req.userId = userId;
    next();
  } catch (e) {
    next(e);
  }
};
