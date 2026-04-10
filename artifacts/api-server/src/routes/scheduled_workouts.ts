import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, scheduledWorkoutsTable } from "@workspace/db";
import {
  CreateScheduledWorkoutBody,
  GetScheduledWorkoutParams,
  UpdateScheduledWorkoutParams,
  UpdateScheduledWorkoutBody,
  DeleteScheduledWorkoutParams,
  ListScheduledWorkoutsResponse,
  GetScheduledWorkoutResponse,
  UpdateScheduledWorkoutResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/requireAuth";
import { serializeRow, serializeRows } from "../lib/serialize";

const router: IRouter = Router();

router.get("/scheduled-workouts", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const rows = await db.select().from(scheduledWorkoutsTable)
    .where(eq(scheduledWorkoutsTable.userId, userId))
    .orderBy(scheduledWorkoutsTable.scheduledDate);
  res.json(ListScheduledWorkoutsResponse.parse(serializeRows(rows as Record<string, unknown>[])));
});

router.post("/scheduled-workouts", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateScheduledWorkoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.session.userId!;
  const [row] = await db.insert(scheduledWorkoutsTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(GetScheduledWorkoutResponse.parse(serializeRow(row as Record<string, unknown>)));
});

router.get("/scheduled-workouts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetScheduledWorkoutParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.session.userId!;
  const [row] = await db.select().from(scheduledWorkoutsTable)
    .where(and(eq(scheduledWorkoutsTable.id, params.data.id), eq(scheduledWorkoutsTable.userId, userId)));
  if (!row) {
    res.status(404).json({ error: "Scheduled workout not found" });
    return;
  }
  res.json(GetScheduledWorkoutResponse.parse(serializeRow(row as Record<string, unknown>)));
});

router.patch("/scheduled-workouts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateScheduledWorkoutParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateScheduledWorkoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.session.userId!;
  const [row] = await db
    .update(scheduledWorkoutsTable)
    .set(parsed.data)
    .where(and(eq(scheduledWorkoutsTable.id, params.data.id), eq(scheduledWorkoutsTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Scheduled workout not found" });
    return;
  }
  res.json(UpdateScheduledWorkoutResponse.parse(serializeRow(row as Record<string, unknown>)));
});

router.delete("/scheduled-workouts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteScheduledWorkoutParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.session.userId!;
  const [deleted] = await db.delete(scheduledWorkoutsTable)
    .where(and(eq(scheduledWorkoutsTable.id, params.data.id), eq(scheduledWorkoutsTable.userId, userId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Scheduled workout not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
