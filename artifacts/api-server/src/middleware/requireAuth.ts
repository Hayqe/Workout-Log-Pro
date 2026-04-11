import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    logger.warn({
      msg: "requireAuth: no session userId",
      sessionID: req.sessionID,
      hasCookie: !!req.headers.cookie,
      method: req.method,
      url: req.url,
    });
    res.status(401).json({ error: "Unauthorized. Please log in." });
    return;
  }
  next();
}
