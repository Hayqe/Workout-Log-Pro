import { Router, type IRouter } from "express";
import { db, userSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";
import { encrypt, decrypt } from "../lib/encrypt";

const router: IRouter = Router();

router.get("/settings", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const [row] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, userId));
  if (!row) {
    res.json({ komootUsername: null, hasKomootPassword: false });
    return;
  }
  res.json({
    komootUsername: row.komootUsername ?? null,
    hasKomootPassword: !!row.komootPasswordEncrypted,
  });
});

router.put("/settings", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { komootUsername, komootPassword } = req.body as {
    komootUsername?: string;
    komootPassword?: string;
  };

  const [existing] = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, userId));

  const komootPasswordEncrypted = komootPassword
    ? encrypt(komootPassword)
    : existing?.komootPasswordEncrypted ?? null;

  const values = {
    userId,
    komootUsername: komootUsername?.trim() || null,
    komootPasswordEncrypted,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(userSettingsTable).set(values).where(eq(userSettingsTable.userId, userId));
  } else {
    await db.insert(userSettingsTable).values(values);
  }

  res.json({ ok: true });
});

router.delete("/settings/komoot-password", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  await db.update(userSettingsTable)
    .set({ komootPasswordEncrypted: null, updatedAt: new Date() })
    .where(eq(userSettingsTable.userId, userId));
  res.json({ ok: true });
});

export default router;
