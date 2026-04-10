import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
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

const router: IRouter = Router();

router.get("/workouts", async (req, res): Promise<void> => {
  const workouts = await db.select().from(workoutsTable).orderBy(workoutsTable.createdAt);
  res.json(ListWorkoutsResponse.parse(workouts));
});

router.post("/workouts", async (req, res): Promise<void> => {
  const parsed = CreateWorkoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [workout] = await db.insert(workoutsTable).values(parsed.data).returning();
  res.status(201).json(GetWorkoutResponse.parse(workout));
});

router.get("/workouts/:id", async (req, res): Promise<void> => {
  const params = GetWorkoutParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [workout] = await db.select().from(workoutsTable).where(eq(workoutsTable.id, params.data.id));
  if (!workout) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }
  res.json(GetWorkoutResponse.parse(workout));
});

router.patch("/workouts/:id", async (req, res): Promise<void> => {
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
  const [workout] = await db
    .update(workoutsTable)
    .set(parsed.data)
    .where(eq(workoutsTable.id, params.data.id))
    .returning();
  if (!workout) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }
  res.json(UpdateWorkoutResponse.parse(workout));
});

router.delete("/workouts/:id", async (req, res): Promise<void> => {
  const params = DeleteWorkoutParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(workoutsTable).where(eq(workoutsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
