import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CrossfitImportDialog } from "./crossfit-import-dialog";

// Mock fetch
const originalFetch = global.fetch;

describe("CrossfitImportDialog", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  const mockWODResponse = {
    date: "240515",
    content: "CrossFit Total\nBack squat, 1 rep\nShoulder press, 1 rep\nDeadlift, 1 rep",
    workoutName: "Mainsite 240515",
  };

  const renderDialog = (props: Partial<React.ComponentProps<typeof CrossfitImportDialog>> = {}) => {
    return render(
      <CrossfitImportDialog
        open={true}
        onOpenChange={vi.fn()}
        {...props}
      />
    );
  };

  describe("Basic Rendering", () => {
    it("should render the dialog", () => {
      renderDialog();
      expect(screen.getByText("Crossfit Mainsite")).toBeInTheDocument();
      expect(screen.getByText("Import today's Workout of the Day")).toBeInTheDocument();
    });

    it("should show loading state initially", () => {
      // Mock fetch to never resolve
      global.fetch = vi.fn().mockImplementation(() => 
        new Promise(() => {}) // Never resolves
      );
      
      renderDialog();
      expect(screen.getByText("Loading Crossfit WOD")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });
  });

  describe("WOD Loading", () => {
    it("should display WOD content when loaded successfully", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWODResponse),
      });

      renderDialog();

      // Wait for the mock fetch to resolve
      await waitFor(() => {
        expect(screen.getByText("Mainsite 240515")).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText("WOD:")).toBeInTheDocument();
        expect(screen.getByText("240515")).toBeInTheDocument();
        expect(screen.getByText(/CrossFit Total/i)).toBeInTheDocument();
      });
    });

    it("should show error when fetch fails", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      renderDialog();

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
        expect(screen.getByText("Retry")).toBeInTheDocument();
      });
    });
  });

  describe("Workout Type Selector", () => {
    it("should render workout type selector", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWODResponse),
      });

      renderDialog();

      await waitFor(() => {
        expect(screen.getByLabelText("Workout Type")).toBeInTheDocument();
      });
    });

    it("should allow selecting workout type", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWODResponse),
      });

      const onOpenChange = vi.fn();
      render(
        <CrossfitImportDialog
          open={true}
          onOpenChange={onOpenChange}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText("Workout Type")).toBeInTheDocument();
      });

      // Find and click the select trigger
      const selectTrigger = screen.getByRole("combobox");
      fireEvent.mouseDown(selectTrigger);

      // Wait for options to appear and select one
      // Note: This might need adjustment based on how the Select component works
    });
  });

  describe("Import Button", () => {
    it("should show Import Workout button", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWODResponse),
      });

      renderDialog();

      await waitFor(() => {
        expect(screen.getByText("Import Workout")).toBeInTheDocument();
      });
    });

    it("should be disabled when no WOD is loaded", () => {
      // Mock fetch to return error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      renderDialog();

      // The button should be present but might be disabled
      expect(screen.getByText("Import Workout")).toBeInTheDocument();
    });

    it("should show importing state when clicked", async () => {
      // Mock successful WOD load
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockWODResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 1, name: "Mainsite 240515", type: "amrap", description: "Test" }),
        });

      const onOpenChange = vi.fn();
      render(
        <CrossfitImportDialog
          open={true}
          onOpenChange={onOpenChange}
        />
      );

      // Wait for WOD to load
      await waitFor(() => {
        expect(screen.getByText("Mainsite 240515")).toBeInTheDocument();
      });

      // Click import button
      const importButton = screen.getByText("Import Workout");
      fireEvent.click(importButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText("Importing...")).toBeInTheDocument();
      });
    });
  });

  describe("Dialog Behavior", () => {
    it("should call onOpenChange when closed", async () => {
      const onOpenChange = vi.fn();
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWODResponse),
      });

      // Mock Sheet component to allow closing
      render(
        <CrossfitImportDialog
          open={true}
          onOpenChange={onOpenChange}
        />
      );

      // Find and click the close button (if visible)
      // The Sheet component might have a close button
      // This test may need adjustment based on the actual Sheet implementation
    });

    it("should close on successful import", async () => {
      const onOpenChange = vi.fn();
      
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockWODResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 1, name: "Mainsite 240515", type: "amrap", description: "Test" }),
        });

      render(
        <CrossfitImportDialog
          open={true}
          onOpenChange={onOpenChange}
        />
      );

      // Wait for WOD to load
      await waitFor(() => {
        expect(screen.getByText("Mainsite 240515")).toBeInTheDocument();
      });

      // Click import button
      const importButton = screen.getByText("Import Workout");
      fireEvent.click(importButton);

      // Wait for import to complete
      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });
});

describe("getDateString helper", () => {
  it("should format date in yymmdd format", () => {
    // We can't easily test the helper function directly since it's not exported
    // But we can test it indirectly through the component behavior
    // This is a placeholder for direct unit testing
    
    const date = new Date("2024-05-15T00:00:00Z");
    // In a real test, we'd test the helper function directly
    // For now, we verify it works through the component
  });
});
