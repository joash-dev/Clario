import type { NextFunction, Request, RequestHandler, Response } from "express";

function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export const requestLogger: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const ts = formatTimestamp(new Date());
  console.log(`[${ts}] ${req.method} ${req.originalUrl}`);
  next();
};
