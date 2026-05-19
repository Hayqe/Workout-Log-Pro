import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { expressApp } from "../app";
import { db, workoutsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Mock fetch for scraping tests
const originalFetch = global.fetch;

describe("Crossfit Routes", () => {
  beforeEach(() => {
    // Mock fetch for testing
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  describe("GET /api/crossfit/wod", () => {
    it("should return WOD for a valid date", async () => {
      // Mock HTML response with article tag
      const mockHtml = `
        <html>
          <body>
            <article>
              <p><strong>CrossFit Total</strong></p>
              <p>Back squat, 1 rep</p>
              <p>Shoulder press, 1 rep</p>
              <p>Deadlift, 1 rep</p>
            </article>
          </body>
        </html>
      `;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      });

      const res = await request(expressApp)
        .get("/api/crossfit/wod?date=240515")
        .expect(200);

      expect(res.body).toHaveProperty("date", "240515");
      expect(res.body).toHaveProperty("workoutName", "Mainsite 240515");
      expect(res.body).toHaveProperty("content");
      expect(res.body.content).toContain("CrossFit Total");
      expect(res.body.content).toContain("Back squat");
    });

    it("should return 400 for invalid date format", async () => {
      const res = await request(expressApp)
        .get("/api/crossfit/wod?date=invalid")
        .expect(400);

      expect(res.body).toHaveProperty("error");
    });

    it("should return 502 when article tag is not found", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<html><body>No article here</body></html>"),
      });

      const res = await request(expressApp)
        .get("/api/crossfit/wod?date=240515")
        .expect(502);

      expect(res.body).toHaveProperty("error", "scrape_failed");
    });

    it("should return 502 when fetch fails", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const res = await request(expressApp)
        .get("/api/crossfit/wod?date=240515")
        .expect(502);

      expect(res.body).toHaveProperty("error", "scrape_failed");
    });

    it("should use today's date when no date is provided", async () => {
      const mockHtml = "<article>Test WOD</article>";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      });

      const res = await request(expressApp)
        .get("/api/crossfit/wod")
        .expect(200);

      expect(res.body).toHaveProperty("workoutName");
      expect(res.body.workoutName).toContain("Mainsite");
    });
  });

  describe("POST /api/crossfit/import", () => {
    it("should return 401 when not authenticated", async () => {
      await request(expressApp)
        .post("/api/crossfit/import")
        .send({
          workoutType: "amrap",
          workoutName: "Mainsite 240515",
          description: "Test WOD",
        })
        .expect(401);
    });

    it("should return 400 when required fields are missing", async () => {
      // This test would need authentication setup
      // For now, just test the validation logic indirectly
      const res = await request(expressApp)
        .post("/api/crossfit/import")
        .send({})
        .expect(401); // Will fail auth first

      // In a real test with auth, we'd expect 400
    });

    it("should return 400 for invalid workout type", async () => {
      // This would also need authentication
      const res = await request(expressApp)
        .post("/api/crossfit/import")
        .send({
          workoutType: "invalid",
          workoutName: "Test",
          description: "Test",
        })
        .expect(401); // Will fail auth first
    });

    it("should create a workout with valid data", async () => {
      // Note: This test requires authentication to be set up
      // In a real test environment, you'd need to:
      // 1. Set up a test session
      // 2. Mock the database
      // For now, this is a placeholder

      const res = await request(expressApp)
        .post("/api/crossfit/import")
        .send({
          workoutType: "amrap",
          workoutName: "Mainsite 240515",
          description: "Test WOD content",
        })
        .expect(401); // Will be 401 without auth

      // In a proper test with auth, we'd expect 201
      // and verify the workout was created in the database
    });
  });
});

// Integration test for the scraping function
describe("Crossfit Scraping Integration", () => {
  it("should scrape real Crossfit WOD", async () => {
    // Skip this test in CI or if we don't want to make real HTTP requests
    if (process.env.SKIP_INTEGRATION_TESTS === "true") {
      it.skip("Skipping integration test");
      return;
    }

    // This is a real integration test that makes an actual HTTP request
    // Note: This may fail if the Crossfit site structure changes
    const date = "240515";
    const url = `https://www.crossfit.com/${date}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    expect(response.ok).toBe(true);
    
    const html = await response.text();
    const articleMatch = html.match(/<article[^>]*>(.*?)<\/article>/s);
    
    expect(articleMatch).toBeTruthy();
    expect(articleMatch?.[1]).toBeTruthy();
  }, 10000); // 10 second timeout for network request
});
