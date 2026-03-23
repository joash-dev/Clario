import { Router } from "express";

const router = Router();

/**
 * Liveness probe — no DB check (readiness can be added later with Prisma.$queryRaw).
 */
router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

export { router as healthRouter };
