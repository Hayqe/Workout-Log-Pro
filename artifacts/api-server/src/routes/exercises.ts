import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, exercisesTable } from "@workspace/db";
import {
  CreateExerciseBody,
  GetExerciseParams,
  DeleteExerciseParams,
  ListExercisesResponse,
  GetExerciseResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/exercises", async (req, res): Promise<void> => {
  const exercises = await db.select().from(exercisesTable).orderBy(exercisesTable.name);
  res.json(ListExercisesResponse.parse(exercises));
});

router.post("/exercises", async (req, res): Promise<void> => {
  const parsed = CreateExerciseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [exercise] = await db.insert(exercisesTable).values(parsed.data).returning();
  res.status(201).json(GetExerciseResponse.parse(exercise));
});

router.get("/exercises/:id", async (req, res): Promise<void> => {
  const params = GetExerciseParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [exercise] = await db.select().from(exercisesTable).where(eq(exercisesTable.id, params.data.id));
  if (!exercise) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }
  res.json(GetExerciseResponse.parse(exercise));
});

router.delete("/exercises/:id", async (req, res): Promise<void> => {
  const params = DeleteExerciseParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(exercisesTable).where(eq(exercisesTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
