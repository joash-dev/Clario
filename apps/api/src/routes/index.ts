import { Router } from "express";
import { aiRouter } from "./ai.routes";
import { authRouter } from "./auth.routes";
import { healthRouter } from "./health.routes";
import { meRouter } from "./me.routes";
import { noteRouter } from "./note.routes";
import { taskRouter } from "./task.routes";

const router = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/me", meRouter);
router.use("/ai", aiRouter);
router.use("/tasks", taskRouter);
router.use("/notes", noteRouter);

export { router as apiRouter };
