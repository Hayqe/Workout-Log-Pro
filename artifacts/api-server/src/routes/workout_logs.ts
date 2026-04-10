import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, workoutLogsTable } from "@workspace/db";
import {
  CreateWorkoutLogBody,
  GetWorkoutLogParams,
  UpdateWorkoutLogParams,
  UpdateWorkoutLogBody,
  DeleteWorkoutLogParams,
  ListWorkoutLogsResponse,
  GetWorkoutLogResponse,
  UpdateWorkoutLogResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/requireAuth";
import { serializeRow, serializeRows } from "../lib/serialize";

const router: IRouter = Router();

router.get("/workout-logs", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const rows = await db.select().from(workoutLogsTable)
    .where(eq(workoutLogsTable.userId, userId))
    .orderBy(workoutLogsTable.loggedAt);
  res.json(ListWorkoutLogsResponse.parse(serializeRows(rows as Record<string, unknown>[])));
});

router.post("/workout-logs", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateWorkoutLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.session.userId!;
  const [row] = await db.insert(workoutLogsTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(GetWorkoutLogResponse.parse(serializeRow(row as Record<string, unknown>)));
});

router.get("/workout-logs/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetWorkoutLogParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.session.userId!;
  const [row] = await db.select().from(workoutLogsTable)
    .where(and(eq(workoutLogsTable.id, params.data.id), eq(workoutLogsTable.userId, userId)));
  if (!row) {
    res.status(404).json({ error: "Workout log not found" });
    return;
  }
  res.json(GetWorkoutLogResponse.parse(serializeRow(row as Record<string, unknown>)));
});

router.patch("/workout-logs/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateWorkoutLogParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateWorkoutLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.session.userId!;
  const [row] = await db
    .update(workoutLogsTable)
    .set(parsed.data)
    .where(and(eq(workoutLogsTable.id, params.data.id), eq(workoutLogsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Workout log not found" });
    return;
  }
  res.json(UpdateWorkoutLogResponse.parse(serializeRow(row as Record<string, unknown>)));
});

router.delete("/workout-logs/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteWorkoutLogParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.session.userId!;
  const [deleted] = await db.delete(workoutLogsTable)
    .where(and(eq(workoutLogsTable.id, params.data.id), eq(workoutLogsTable.userId, userId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Workout log not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
