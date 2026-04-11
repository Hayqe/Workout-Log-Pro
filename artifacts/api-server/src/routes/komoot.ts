import { Router, type IRouter } from "express";
import { db, userSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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
  date: string;
  sport: string;
  distance: number;  // metres
  duration: number;  // seconds
  elevation_up?: number;
  elevation_down?: number;
  changed_at?: string;
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

    const body = await toursRes.json() as Record<string, any>;
    console.log("[komoot] response top-level keys:", Object.keys(body));
    if (body._embedded) console.log("[komoot] _embedded keys:", Object.keys(body._embedded));
    if (body.page) console.log("[komoot] page:", JSON.stringify(body.page));

    // Try all possible HAL embedded key variants
    const embeddedKeys = body._embedded ? Object.keys(body._embedded) : [];
    const allTours: KomootTour[] = (
      body._embedded?.tours ??
      (embeddedKeys.length === 1 ? body._embedded[embeddedKeys[0]] : undefined) ??
      body.tours ??
      []
    );
    console.log("[komoot] allTours count:", allTours.length);
    if (allTours[0]) console.log("[komoot] first tour sample:", JSON.stringify(allTours[0]).slice(0, 400));

    // Keep only recorded tours; fall back to all tours if filter yields nothing
    const filtered = allTours.filter((t: any) =>
      t.type === "tour_recorded" || t.constitution === "CONFIRMED"
    );
    const rawTours = filtered.length > 0 ? filtered : allTours;
    console.log("[komoot] after filter:", rawTours.length, "(filter had:", filtered.length, ")");

    const tours = rawTours
      .map(t => ({
        id: String(t.id),
        name: t.name,
        date: t.date,
        sport: t.sport,
        distanceM: t.distance ?? 0,
        durationS: t.duration ?? 0,
        elevationUp: t.elevation_up ?? 0,
        elevationDown: t.elevation_down ?? 0,
      }))
      // Sort by date descending (newest first) on our side
      .sort((a, b) => b.date.localeCompare(a.date));

    res.json({ tours, komootUsername: account.username });
  } catch (e: any) {
    if (e.code === "auth_failed") { res.status(401).json({ error: "auth_failed" }); return; }
    res.status(502).json({ error: "komoot_error", message: e.message });
  }
});

export default router;
