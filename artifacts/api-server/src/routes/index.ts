import { Router, type IRouter } from "express";
import healthRouter from "./health";
import exercisesRouter from "./exercises";
import workoutsRouter from "./workouts";
import scheduledWorkoutsRouter from "./scheduled_workouts";
import workoutLogsRouter from "./workout_logs";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(exercisesRouter);
router.use(workoutsRouter);
router.use(scheduledWorkoutsRouter);
router.use(workoutLogsRouter);
router.use(dashboardRouter);

export default router;
