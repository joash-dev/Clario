import type { RequestHandler } from "express";

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      message: `Not found: ${req.method} ${req.path}`,
      code: "NOT_FOUND",
    },
  });
};
