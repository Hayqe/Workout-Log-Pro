import { Router, type IRouter } from "express";
import { eq, and, isNull, or } from "drizzle-orm";
import { db, exercisesTable, workoutsTable } from "@workspace/db";
import {
  CreateExerciseBody,
  GetExerciseParams,
  DeleteExerciseParams,
  ListExercisesResponse,
  GetExerciseResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middleware/requireAuth";
import { serializeRow, serializeRows } from "../lib/serialize";

const router: IRouter = Router();

router.get("/exercises", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const exercises = await db.select().from(exercisesTable)
    .where(or(isNull(exercisesTable.userId), eq(exercisesTable.userId, userId)))
    .orderBy(exercisesTable.name);
  res.json(ListExercisesResponse.parse(serializeRows(exercises as Record<string, unknown>[])));
});

router.post("/exercises", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateExerciseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.session.userId!;
  const [exercise] = await db.insert(exercisesTable).values({ ...parsed.data, userId }).returning();
  res.status(201).json(GetExerciseResponse.parse(serializeRow(exercise as Record<string, unknown>)));
});

router.get("/exercises/:id", requireAuth, async (req, res): Promise<void> => {
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
  res.json(GetExerciseResponse.parse(serializeRow(exercise as Record<string, unknown>)));
});

router.delete("/exercises/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteExerciseParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.session.userId!;

  const [exercise] = await db.select().from(exercisesTable)
    .where(and(eq(exercisesTable.id, params.data.id), eq(exercisesTable.userId, userId)));
  if (!exercise) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  const allWorkouts = await db.select({ exercises: workoutsTable.exercises }).from(workoutsTable);
  const nameLower = exercise.name.toLowerCase();
  const usedInWorkout = allWorkouts.some((w) => {
    try {
      const parsed = JSON.parse(w.exercises);
      if (Array.isArray(parsed)) {
        return parsed.some((ex: any) => typeof ex.name === "string" && ex.name.toLowerCase() === nameLower);
      }
    } catch {}
    return false;
  });
  if (usedInWorkout) {
    res.status(409).json({ error: `"${exercise.name}" is used in one or more workout templates and cannot be deleted.` });
    return;
  }

  await db.delete(exercisesTable)
    .where(and(eq(exercisesTable.id, params.data.id), eq(exercisesTable.userId, userId)));
  res.sendStatus(204);
});

export default router;
