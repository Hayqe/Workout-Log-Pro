import { Router, type IRouter } from "express";
import { db, userSettingsTable, workoutsTable, workoutLogsTable } from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { decrypt } from "../lib/encrypt";

const router: IRouter = Router();

/* ── helpers ── */

async function getKomootCreds(userId: number) {
  const [row] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, userId));
  if (!row?.komootUsername || !row?.komootPasswordEncrypted) return null;
  return { email: row.komootUsername, password: decrypt(row.komootPasswordEncrypted) };
}

function basicAuth(email: string, password: string) {
  return "Basic " + Buffer.from(`${email}:${password}`).toString("base64");
}

interface KomootAccount {
  username: string; // numeric user id
  email: string;
}

interface KomootTour {
  id: string | number;
  name: string;
  // Komoot uses different date field names depending on API version
  date?: string;
  recordedAt?: string;
  createdAt?: string;
  changedAt?: string;
  sport?: string;
  distance: number;  // metres
  duration: number;  // seconds
  elevation_up?: number;
  elevationUp?: number;
}

async function authKomoot(email: string, password: string): Promise<KomootAccount> {
  const encoded = encodeURIComponent(email);
  const res = await fetch(`https://api.komoot.de/v006/account/email/${encoded}/`, {
    headers: { Authorization: basicAuth(email, password), Accept: "application/json" },
  });
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error("auth_failed"), { code: "auth_failed" });
  if (!res.ok) throw new Error(`Komoot account fetch failed: ${res.status}`);
  const data = await res.json() as KomootAccount;
  console.log("[komoot] auth OK, userId:", data.username);
  return data;
}

/* ── GET /komoot/tours ── */

router.get("/komoot/tours", requireAuth, async (req, res): Promise<void> => {
  const creds = await getKomootCreds(req.session.userId!);
  if (!creds) { res.status(422).json({ error: "no_credentials" }); return; }

  try {
    const account = await authKomoot(creds.email, creds.password);
    const auth = basicAuth(creds.email, creds.password);

    // Fetch ALL tours (no type filter — some API versions ignore/break with type param)
    // We filter to recorded-only on our side
    const url = `https://api.komoot.de/v006/users/${account.username}/tours/`;
    const toursRes = await fetch(url, { headers: { Authorization: auth, Accept: "application/json" } });

    console.log("[komoot] tours status:", toursRes.status);
    if (!toursRes.ok) throw new Error(`Komoot tours request failed: ${toursRes.status}`);

    const body = await toursRes.json() as any;

    // Komoot may return a direct array, a HAL {_embedded:{tours:[]}}, or {tours:[]}
    let allTours: KomootTour[];
    if (Array.isArray(body)) {
      // Direct array response
      allTours = body;
    } else if (body?._embedded) {
      const embeddedKeys = Object.keys(body._embedded);
      allTours = body._embedded.tours ?? (embeddedKeys.length === 1 ? body._embedded[embeddedKeys[0]] : []) ?? [];
    } else if (Array.isArray(body?.tours)) {
      allTours = body.tours;
    } else {
      allTours = [];
    }
    console.log("[komoot] allTours count:", allTours.length, "| isArray:", Array.isArray(body));
    if (allTours[0]) console.log("[komoot] first tour sample:", JSON.stringify(allTours[0]).slice(0, 400));

    // Keep only recorded tours; fall back to all tours if filter yields nothing
    const filtered = allTours.filter((t: any) =>
      t.type === "tour_recorded" || t.constitution === "CONFIRMED"
    );
    const rawTours = filtered.length > 0 ? filtered : allTours;
    console.log("[komoot] after filter:", rawTours.length, "(filter had:", filtered.length, ")");

    // Known sport keywords that appear in auto-generated Komoot tour names
    const SPORT_KEYWORDS = [
      "touringbicycle","racebike","mtb","e_mtb","e_touringbicycle","cycling",
      "running","jogging","hiking","hike","mountaineering","nordic_walking","skating","swimming",
    ];
    function extractSport(t: any): string {
      if (t.sport) return String(t.sport);
      const nameLower = (t.name ?? "").toLowerCase();
      return SPORT_KEYWORDS.find(k => nameLower.startsWith(k)) ?? "other";
    }
    function toIsoDate(raw: string | undefined): string {
      if (!raw) return new Date().toISOString();
      const d = new Date(raw);
      return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    }

    const tours = rawTours
      .map((t: any) => {
        const dateRaw = t.recordedAt ?? t.date ?? t.changedAt ?? t.createdAt;
        return {
          id: String(t.id),
          name: t.name ?? `Route ${t.id}`,
          date: toIsoDate(dateRaw),
          sport: extractSport(t),
          distanceM: t.distance ?? 0,
          durationS: t.duration ?? 0,
          elevationUp: t.elevation_up ?? t.elevationUp ?? 0,
          elevationDown: t.elevation_down ?? t.elevationDown ?? 0,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    res.json({ tours, komootUsername: account.username });
  } catch (e: any) {
    if (e.code === "auth_failed") { res.status(401).json({ error: "auth_failed" }); return; }
    res.status(502).json({ error: "komoot_error", message: e.message });
  }
});

/* ── POST /komoot/import ── */
// Imports a single Komoot tour as a cardio workout log.
// Auto-links to an existing workout template if one with the same name exists,
// so repeated imports of the same activity are recorded as "herhalingen".

router.post("/komoot/import", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { workoutName, loggedAt, durationMinutes, results, notes } = req.body;

  if (!workoutName || !loggedAt) {
    res.status(400).json({ error: "workoutName and loggedAt are required" });
    return;
  }

  try {
    // 1. Find an existing cardio workout template with this name (owned by user)
    let workoutId: number | null = null;

    const [existingWorkout] = await db
      .select({ id: workoutsTable.id })
      .from(workoutsTable)
      .where(and(eq(workoutsTable.userId, userId), eq(workoutsTable.name, workoutName), eq(workoutsTable.type, "cardio")));

    if (existingWorkout) {
      workoutId = existingWorkout.id;
    } else {
      // 2. Check if a previous log with the same name already has a workoutId
      const [prevLog] = await db
        .select({ workoutId: workoutLogsTable.workoutId })
        .from(workoutLogsTable)
        .where(and(
          eq(workoutLogsTable.userId, userId),
          eq(workoutLogsTable.workoutName, workoutName),
          isNotNull(workoutLogsTable.workoutId),
        ));

      if (prevLog?.workoutId) {
        workoutId = prevLog.workoutId;
      } else {
        // 3. Create a new cardio workout template so future imports link up
        const [newWorkout] = await db
          .insert(workoutsTable)
          .values({
            name: workoutName,
            type: "cardio",
            description: "Geïmporteerd via Komoot",
            exercises: "[]",
            userId,
          })
          .returning({ id: workoutsTable.id });
        workoutId = newWorkout?.id ?? null;
      }
    }

    // 4. Insert the workout log linked to the workout template
    const [log] = await db
      .insert(workoutLogsTable)
      .values({
        workoutId,
        workoutName,
        workoutType: "cardio",
        loggedAt,
        durationMinutes: durationMinutes ?? null,
        notes: notes ?? null,
        results: results ?? "{}",
        userId,
      })
      .returning();

    res.status(201).json(log);
  } catch (e: any) {
    res.status(500).json({ error: "Import mislukt", message: e.message });
  }
});

export default router;
