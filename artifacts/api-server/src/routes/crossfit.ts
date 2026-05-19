import { Router, type IRouter } from "express";
import { db, workoutsTable } from "@workspace/db";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

/* ── Helpers ── */

/**
 * Generate date string in yymmdd format
 * @param date - Optional date, defaults to today
 * @returns Date string in yymmdd format (e.g., "240515")
 */
function getDateString(date?: Date): string {
  const d = date ?? new Date();
  const year = d.getFullYear().toString().slice(2);
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Extract workout name from date
 * @param date - Date string in yymmdd format
 * @returns Workout name (e.g., "Mainsite 240515")
 */
function getWorkoutName(date: string): string {
  return `Mainsite ${date}`;
}

/**
 * Scrape Crossfit WOD from crossfit.com
 * @param date - Date string in yymmdd format
 * @returns Promise with date and content
 * @throws Error if scraping fails
 */
async function scrapeCrossfitWOD(date: string): Promise<{ date: string; content: string }> {
  const url = `https://www.crossfit.com/${date}`;
  
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Crossfit WOD: HTTP ${response.status}`);
  }

  const html = await response.text();
  
  // Extract content from <article> tag
  // Using regex with 's' flag for dotall (to match across newlines)
  const articleMatch = html.match(/<article[^>]*>(.*?)<\/article>/s);
  
  if (!articleMatch) {
    throw new Error("Article tag not found in Crossfit page");
  }

  const articleContent = articleMatch[1];
  
  // Clean up HTML: convert to readable markdown-like format
  // 1. First, remove unwanted tags (scripts, styles, svgs, etc.)
  // 2. Then convert remaining HTML to readable text with proper spacing
  // IMPORTANT: Preserve newlines from <p> and <br> tags
  const content = articleContent
    .replace(/<script[^>]*>.*?<\/script>/gs, "") // Remove script tags and content
    .replace(/<style[^>]*>.*?<\/style>/gs, "") // Remove style tags and content
    .replace(/<svg[^>]*>.*?<\/svg>/gs, "") // Remove svg tags and content
    .replace(/<img[^>]*>/g, "") // Remove img tags
    .replace(/<iframe[^>]*>.*?<\/iframe>/gs, "") // Remove iframe tags
    .replace(/<nav[^>]*>.*?<\/nav>/gs, "") // Remove nav sections
    .replace(/<header[^>]*>.*?<\/header>/gs, "") // Remove header sections
    .replace(/<footer[^>]*>.*?<\/footer>/gs, "") // Remove footer sections
    .replace(/<div[^>]*>.*?<\/div>/gs, "") // Remove div tags and content
    .replace(/<span[^>]*>(.*?)<\/span>/gs, "$1") // Remove span tags but keep content
    .replace(/<strong[^>]*>(.*?)<\/strong>/gs, "$1") // Remove strong tags but keep content
    .replace(/<em[^>]*>(.*?)<\/em>/gs, "$1") // Remove em tags but keep content
    .replace(/<b[^>]*>(.*?)<\/b>/gs, "$1") // Remove b tags but keep content
    .replace(/<i[^>]*>(.*?)<\/i>/gs, "$1") // Remove i tags but keep content
    .replace(/<\/p>/g, "\n\n") // Replace closing p with double newline
    .replace(/<p[^>]*>/g, "") // Remove opening p tags
    .replace(/<br\s*\/?>/g, "\n") // Replace br with newline
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, "$2 ($1)") // Convert links: "text (url)"
    .replace(/<[^>]+>/g, "") // Remove any remaining HTML tags
    .replace(/[ \t]+/g, " ") // Collapse horizontal whitespace only (preserve newlines)
    .replace(/\n{3,}/g, "\n\n") // Limit to max 2 consecutive newlines
    .trim();

  if (!content) {
    throw new Error("No content found in article tag");
  }

  return { date, content };
}

/* ── GET /crossfit/wod ── */
// Get the Crossfit Workout of the Day
// Optional date parameter in yymmdd format, defaults to today
router.get("/crossfit/wod", requireAuth, async (req, res): Promise<void> => {
  try {
    // Get date from query param or use today
    const dateParam = req.query.date as string | undefined;
    let date = dateParam;
    
    // Validate date format (yymmdd - 6 digits)
    if (dateParam && !/^\d{6}$/.test(dateParam)) {
      res.status(400).json({ error: "Invalid date format. Use yymmdd (e.g., 240515)" });
      return;
    }
    
    // If no date provided, use today
    if (!dateParam) {
      date = getDateString();
    }

    const result = await scrapeCrossfitWOD(date);
    
    res.json({
      date: result.date,
      content: result.content,
      workoutName: getWorkoutName(result.date),
    });
  } catch (e: any) {
    console.error("[crossfit] Error scraping WOD:", e.message);
    res.status(502).json({ 
      error: "scrape_failed", 
      message: e.message ?? "Failed to scrape Crossfit WOD" 
    });
  }
});

/* ── POST /crossfit/import ── */
// Import a Crossfit WOD as a workout template
// Creates a new workout with the scraped content in the exercises field (freeText)
router.post("/crossfit/import", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { workoutType, workoutName, description } = req.body as {
    workoutType?: string;
    workoutName?: string;
    description?: string;
  };

  // Validate required fields
  if (!workoutType || !workoutName || !description) {
    res.status(400).json({
      error: "Missing required fields",
      required: ["workoutType", "workoutName", "description"],
    });
    return;
  }

  // Validate workout type - for Crossfit, only amrap, rft, emom make sense
  const validTypes = ["amrap", "rft", "emom", "bodybuilding", "cardio"];
  if (!validTypes.includes(workoutType)) {
    res.status(400).json({
      error: "Invalid workout type",
      validTypes,
    });
    return;
  }

  try {
    // For Crossfit workouts (amrap, rft, emom), store the WOD content in exercises.freeText
    // This ensures it displays in the crossfit-card section, not in the description
    const isCrossfitType = ["amrap", "rft", "emom"].includes(workoutType);
    
    const exercises = isCrossfitType 
      ? JSON.stringify({ freeText: description })
      : "[]";

    // Create the workout
    const [workout] = await db
      .insert(workoutsTable)
      .values({
        name: workoutName,
        type: workoutType,
        // For Crossfit types, description can be empty or used for additional notes
        // The main content goes in exercises.freeText
        description: isCrossfitType ? null : description,
        userId,
        exercises,
      })
      .returning();

    if (!workout) {
      res.status(500).json({ error: "Failed to create workout" });
      return;
    }

    res.status(201).json({
      id: workout.id,
      name: workout.name,
      type: workout.type,
      exercises: workout.exercises,
      message: "Workout imported successfully",
    });
  } catch (e: any) {
    console.error("[crossfit] Error importing workout:", e);
    res.status(500).json({
      error: "Import failed",
      message: e.message ?? "Failed to import workout",
    });
  }
});

export default router;
