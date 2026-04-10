import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
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

const router: IRouter = Router();

router.get("/scheduled-workouts", async (req, res): Promise<void> => {
  const rows = await db.select().from(scheduledWorkoutsTable).orderBy(scheduledWorkoutsTable.scheduledDate);
  res.json(ListScheduledWorkoutsResponse.parse(rows));
});

router.post("/scheduled-workouts", async (req, res): Promise<void> => {
  const parsed = CreateScheduledWorkoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(scheduledWorkoutsTable).values(parsed.data).returning();
  res.status(201).json(GetScheduledWorkoutResponse.parse(row));
});

router.get("/scheduled-workouts/:id", async (req, res): Promise<void> => {
  const params = GetScheduledWorkoutParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(scheduledWorkoutsTable).where(eq(scheduledWorkoutsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Scheduled workout not found" });
    return;
  }
  res.json(GetScheduledWorkoutResponse.parse(row));
});

router.patch("/scheduled-workouts/:id", async (req, res): Promise<void> => {
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
  const [row] = await db
    .update(scheduledWorkoutsTable)
    .set(parsed.data)
    .where(eq(scheduledWorkoutsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Scheduled workout not found" });
    return;
  }
  res.json(UpdateScheduledWorkoutResponse.parse(row));
});

router.delete("/scheduled-workouts/:id", async (req, res): Promise<void> => {
  const params = DeleteScheduledWorkoutParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(scheduledWorkoutsTable).where(eq(scheduledWorkoutsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Scheduled workout not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
