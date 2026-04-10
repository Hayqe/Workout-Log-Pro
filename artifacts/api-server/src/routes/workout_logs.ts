import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
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

const router: IRouter = Router();

router.get("/workout-logs", async (req, res): Promise<void> => {
  const rows = await db.select().from(workoutLogsTable).orderBy(workoutLogsTable.loggedAt);
  res.json(ListWorkoutLogsResponse.parse(rows));
});

router.post("/workout-logs", async (req, res): Promise<void> => {
  const parsed = CreateWorkoutLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(workoutLogsTable).values(parsed.data).returning();
  res.status(201).json(GetWorkoutLogResponse.parse(row));
});

router.get("/workout-logs/:id", async (req, res): Promise<void> => {
  const params = GetWorkoutLogParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(workoutLogsTable).where(eq(workoutLogsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Workout log not found" });
    return;
  }
  res.json(GetWorkoutLogResponse.parse(row));
});

router.patch("/workout-logs/:id", async (req, res): Promise<void> => {
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
  const [row] = await db
    .update(workoutLogsTable)
    .set(parsed.data)
    .where(eq(workoutLogsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Workout log not found" });
    return;
  }
  res.json(UpdateWorkoutLogResponse.parse(row));
});

router.delete("/workout-logs/:id", async (req, res): Promise<void> => {
  const params = DeleteWorkoutLogParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(workoutLogsTable).where(eq(workoutLogsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Workout log not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
