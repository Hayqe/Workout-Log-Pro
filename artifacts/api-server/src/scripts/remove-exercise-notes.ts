/**
 * Migration script to remove per-exercise notes from workout_logs.results JSON
 * 
 * This is a one-time migration that should be run after deploying the frontend changes
 * that remove the note field from the UI.
 * 
 * Run with: npx tsx artifacts/api-server/src/scripts/remove-exercise-notes.ts
 */

import { db, workoutLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function removeExerciseNotes() {
  console.log("Starting migration to remove exercise notes from workout_logs...\n");
  
  const logs = await db.select().from(workoutLogsTable);
  console.log(`Found ${logs.length} workout logs to process\n`);
  
  let updatedCount = 0;
  let errorCount = 0;
  
  for (const log of logs) {
    if (!log.results) continue;
    
    try {
      const results = JSON.parse(log.results);
      if (!Array.isArray(results)) continue;
      
      // Check if any exercise has a note field
      const hasNotes = results.some((ex: any) => ex.note !== undefined);
      if (!hasNotes) continue;
      
      // Remove note fields from all exercises
      const cleanedResults = results.map((ex: any) => {
        const { note, ...rest } = ex;
        return rest;
      });
      
      // Update the log
      await db.update(workoutLogsTable)
        .set({ results: JSON.stringify(cleanedResults) })
        .where(eq(workoutLogsTable.id, log.id));
      
      console.log(`✓ Updated log ${log.id}: removed exercise notes`);
      updatedCount++;
    } catch (err) {
      console.error(`✗ Failed to process log ${log.id}:`, err);
      errorCount++;
    }
  }
  
  console.log(`\nMigration complete!`);
  console.log(`- Updated: ${updatedCount} logs`);
  console.log(`- Errors: ${errorCount} logs`);
  console.log(`\nNote: This migration only removes the 'note' field from exercise objects in the results JSON.`);
  console.log(`Session notes (stored in the 'notes' column) are preserved.`);
}

removeExerciseNotes().catch(console.error);
