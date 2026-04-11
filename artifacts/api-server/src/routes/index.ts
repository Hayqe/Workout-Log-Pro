import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import exercisesRouter from "./exercises";
import workoutsRouter from "./workouts";
import scheduledWorkoutsRouter from "./scheduled_workouts";
import workoutLogsRouter from "./workout_logs";
import dashboardRouter from "./dashboard";
import settingsRouter from "./settings";
import komootRouter from "./komoot";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(exercisesRouter);
router.use(workoutsRouter);
router.use(scheduledWorkoutsRouter);
router.use(workoutLogsRouter);
router.use(dashboardRouter);
router.use(settingsRouter);
router.use(komootRouter);

export default router;
