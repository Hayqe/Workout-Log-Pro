import { Router, type IRouter } from "express";
import { db, workoutLogsTable, scheduledWorkoutsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

function getMonthBounds() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { first, last };
}

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const allLogs = await db.select().from(workoutLogsTable).where(eq(workoutLogsTable.userId, userId));
  const { monday, sunday } = getWeekBounds();
  const { first, last } = getMonthBounds();

  const weekLogs = allLogs.filter(l => {
    const d = new Date(l.loggedAt);
    return d >= monday && d <= sunday;
  });
  const monthLogs = allLogs.filter(l => {
    const d = new Date(l.loggedAt);
    return d >= first && d <= last;
  });

  const workoutsByType = { bodybuilding: 0, amrap: 0, emom: 0, rft: 0, cardio: 0 };
  for (const log of allLogs) {
    const t = log.workoutType as keyof typeof workoutsByType;
    if (t in workoutsByType) workoutsByType[t]++;
  }

  const totalMinutesThisMonth = monthLogs.reduce((sum, l) => sum + (l.durationMinutes ?? 0), 0);

  const today = new Date().toISOString().split("T")[0];
  const endOfWeek = sunday.toISOString().split("T")[0];
  const allScheduled = await db.select().from(scheduledWorkoutsTable).where(eq(scheduledWorkoutsTable.userId, userId));
  const scheduledThisWeek = allScheduled.filter(s => {
    return s.scheduledDate >= today && s.scheduledDate <= endOfWeek;
  }).length;

  res.json({
    totalWorkoutsLogged: allLogs.length,
    workoutsThisWeek: weekLogs.length,
    workoutsThisMonth: monthLogs.length,
    scheduledThisWeek,
    totalMinutesThisMonth,
    workoutsByType,
  });
});

router.get("/dashboard/recent-logs", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const logs = await db.select().from(workoutLogsTable).where(eq(workoutLogsTable.userId, userId));
  const sorted = [...logs].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
  res.json(sorted.slice(0, 5));
});

router.get("/dashboard/upcoming", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const today = new Date().toISOString().split("T")[0];
  const all = await db.select().from(scheduledWorkoutsTable).where(eq(scheduledWorkoutsTable.userId, userId));
  const upcoming = all
    .filter(s => s.scheduledDate >= today && !s.completed)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    .slice(0, 5);
  res.json(upcoming);
});

router.get("/dashboard/weekly-volume", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const allLogs = await db.select().from(workoutLogsTable).where(eq(workoutLogsTable.userId, userId));
  const volumeMap: Record<string, { bodybuilding: number; amrap: number; emom: number; rft: number; cardio: number }> = {};

  for (const log of allLogs) {
    const date = new Date(log.loggedAt);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + diff);
    const weekKey = monday.toISOString().split("T")[0];

    if (!volumeMap[weekKey]) {
      volumeMap[weekKey] = { bodybuilding: 0, amrap: 0, emom: 0, rft: 0, cardio: 0 };
    }
    const t = log.workoutType as keyof typeof volumeMap[string];
    if (t in volumeMap[weekKey]) {
      volumeMap[weekKey][t]++;
    }
  }

  const result = Object.entries(volumeMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, counts]) => ({ week, ...counts }));

  res.json(result);
});

export default router;
