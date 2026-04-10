import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, workoutsTable } from "@workspace/db";
import {
  CreateWorkoutBody,
  GetWorkoutParams,
  UpdateWorkoutParams,
  UpdateWorkoutBody,
  DeleteWorkoutParams,
  ListWorkoutsResponse,
  GetWorkoutResponse,
  UpdateWorkoutResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/requireAuth";
import { serializeRow, serializeRows } from "../lib/serialize";

const router: IRouter = Router();

router.get("/workouts", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const workouts = await db.select().from(workoutsTable)
    .where(eq(workoutsTable.userId, userId))
    .orderBy(workoutsTable.createdAt);
  res.json(ListWorkoutsResponse.parse(serializeRows(workouts as Record<string, unknown>[])));
});

router.post("/workouts", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateWorkoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.session.userId!;
  const [workout] = await db.insert(workoutsTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(GetWorkoutResponse.parse(serializeRow(workout as Record<string, unknown>)));
});

router.get("/workouts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetWorkoutParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.session.userId!;
  const [workout] = await db.select().from(workoutsTable)
    .where(and(eq(workoutsTable.id, params.data.id), eq(workoutsTable.userId, userId)));
  if (!workout) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }
  res.json(GetWorkoutResponse.parse(serializeRow(workout as Record<string, unknown>)));
});

router.patch("/workouts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateWorkoutParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateWorkoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.session.userId!;
  const [workout] = await db
    .update(workoutsTable)
    .set(parsed.data)
    .where(and(eq(workoutsTable.id, params.data.id), eq(workoutsTable.userId, userId)))
    .returning();
  if (!workout) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }
  res.json(UpdateWorkoutResponse.parse(serializeRow(workout as Record<string, unknown>)));
});

router.delete("/workouts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteWorkoutParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.session.userId!;
  const [deleted] = await db.delete(workoutsTable)
    .where(and(eq(workoutsTable.id, params.data.id), eq(workoutsTable.userId, userId)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
