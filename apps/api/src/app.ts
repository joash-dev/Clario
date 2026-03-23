import cors from "cors";
import express from "express";
import { apiRouter } from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/logger";
import { notFound } from "./middleware/notFound";

export function createApp() {
  const app = express();

  app.use(cors({ origin: true }));
  app.use(express.json());
  app.use(requestLogger);
  app.use("/api/v1", apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
