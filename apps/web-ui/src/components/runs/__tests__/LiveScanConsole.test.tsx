/**
 * Tests for LiveScanConsole Component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LiveScanConsole } from "../LiveScanConsole";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Terminal: () => <span data-testid="icon-terminal">Terminal</span>,
  Pause: () => <span data-testid="icon-pause">Pause</span>,
  Play: () => <span data-testid="icon-play">Play</span>,
  Download: () => <span data-testid="icon-download">Download</span>,
  ChevronDown: () => <span data-testid="icon-chevron">Chevron</span>,
  ArrowDown: () => <span data-testid="icon-arrow">Arrow</span>,
  AlertTriangle: () => <span data-testid="icon-alert">Alert</span>,
  CheckCircle2: () => <span data-testid="icon-check">Check</span>,
  XCircle: () => <span data-testid="icon-x">X</span>,
  Clock: () => <span data-testid="icon-clock">Clock</span>,
  Zap: () => <span data-testid="icon-zap">Zap</span>,
}));

describe("LiveScanConsole", () => {
  const defaultProps = {
    runId: "test-run-123",
    status: null,
    progress: 0,
    logs: [],
    findingsCount: 0,
    isConnected: false,
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render the console title", () => {
      render(<LiveScanConsole {...defaultProps} />);
      expect(screen.getByText("Live Scan Console")).toBeInTheDocument();
    });

    it("should show empty state when no logs", () => {
      render(<LiveScanConsole {...defaultProps} />);
      expect(screen.getByText(/no logs yet/i)).toBeInTheDocument();
    });

    it("should show waiting message when queued", () => {
      render(<LiveScanConsole {...defaultProps} status="queued" />);
      expect(screen.getByText(/waiting for scan to start/i)).toBeInTheDocument();
    });

    it("should render logs when provided", () => {
      const logs = ["[INFO] Starting scan...", "[INFO] Scanning files..."];
      render(<LiveScanConsole {...defaultProps} logs={logs} />);
      
      expect(screen.getByText("[INFO] Starting scan...")).toBeInTheDocument();
      expect(screen.getByText("[INFO] Scanning files...")).toBeInTheDocument();
    });
  });

  describe("Status Display", () => {
    it("should show QUEUED badge when queued", () => {
      render(<LiveScanConsole {...defaultProps} status="queued" />);
      expect(screen.getByText("QUEUED")).toBeInTheDocument();
    });

    it("should show RUNNING badge when running", () => {
      render(<LiveScanConsole {...defaultProps} status="running" />);
      expect(screen.getByText("RUNNING")).toBeInTheDocument();
    });

    it("should show COMPLETE badge when complete", () => {
      render(<LiveScanConsole {...defaultProps} status="complete" />);
      expect(screen.getByText("COMPLETE")).toBeInTheDocument();
    });

    it("should show ERROR badge when error", () => {
      render(<LiveScanConsole {...defaultProps} status="error" />);
      expect(screen.getByText("ERROR")).toBeInTheDocument();
    });
  });

  describe("Progress Display", () => {
    it("should show progress when running", () => {
      render(
        <LiveScanConsole 
          {...defaultProps} 
          status="running" 
          progress={45} 
        />
      );
      expect(screen.getByText("Scanning...")).toBeInTheDocument();
      expect(screen.getByText("45%")).toBeInTheDocument();
    });

    it("should not show progress when not running", () => {
      render(
        <LiveScanConsole 
          {...defaultProps} 
          status="queued" 
          progress={45} 
        />
      );
      expect(screen.queryByText("45%")).not.toBeInTheDocument();
    });
  });

  describe("Findings Count", () => {
    it("should show findings badge when findings exist", () => {
      render(
        <LiveScanConsole 
          {...defaultProps} 
          findingsCount={5} 
        />
      );
      expect(screen.getByText(/5 findings/)).toBeInTheDocument();
    });

    it("should not show findings badge when zero", () => {
      render(<LiveScanConsole {...defaultProps} findingsCount={0} />);
      expect(screen.queryByText(/findings/)).not.toBeInTheDocument();
    });

    it("should use singular for one finding", () => {
      render(
        <LiveScanConsole 
          {...defaultProps} 
          findingsCount={1} 
        />
      );
      expect(screen.getByText(/1 finding(?!s)/)).toBeInTheDocument();
    });
  });

  describe("Connection Status", () => {
    it("should show live indicator when connected", () => {
      render(<LiveScanConsole {...defaultProps} isConnected={true} />);
      expect(screen.getByText("Live")).toBeInTheDocument();
    });

    it("should not show live indicator when disconnected", () => {
      render(<LiveScanConsole {...defaultProps} isConnected={false} />);
      expect(screen.queryByText("Live")).not.toBeInTheDocument();
    });
  });

  describe("Error Display", () => {
    it("should show error message when error prop is set", () => {
      render(
        <LiveScanConsole 
          {...defaultProps} 
          error="Connection failed" 
        />
      );
      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByText("Connection failed")).toBeInTheDocument();
    });
  });

  describe("Completion Message", () => {
    it("should show completion message when complete", () => {
      render(
        <LiveScanConsole 
          {...defaultProps} 
          status="complete"
          findingsCount={3}
        />
      );
      expect(screen.getByText("Scan Complete")).toBeInTheDocument();
      expect(screen.getByText(/Found 3 issues/)).toBeInTheDocument();
    });
  });

  describe("Pause/Play Controls", () => {
    it("should have pause button by default", () => {
      render(<LiveScanConsole {...defaultProps} />);
      expect(screen.getByTestId("icon-pause")).toBeInTheDocument();
    });

    it("should toggle to play when paused", () => {
      render(<LiveScanConsole {...defaultProps} />);
      
      const pauseButton = screen.getByTestId("icon-pause").parentElement;
      if (pauseButton) {
        fireEvent.click(pauseButton);
        expect(screen.getByTestId("icon-play")).toBeInTheDocument();
      }
    });
  });

  describe("Download Functionality", () => {
    it("should have download button", () => {
      render(<LiveScanConsole {...defaultProps} />);
      expect(screen.getByTestId("icon-download")).toBeInTheDocument();
    });

    it("should download logs when clicked", () => {
      const logs = ["Line 1", "Line 2"];
      render(<LiveScanConsole {...defaultProps} logs={logs} />);

      // Mock URL.createObjectURL and URL.revokeObjectURL
      const mockCreateObjectURL = vi.fn().mockReturnValue("blob:url");
      const mockRevokeObjectURL = vi.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      const downloadButton = screen.getByTestId("icon-download").parentElement;
      if (downloadButton) {
        fireEvent.click(downloadButton);
        
        expect(mockCreateObjectURL).toHaveBeenCalled();
        expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:url");
      }
    });
  });

  describe("Log Colorization", () => {
    it("should colorize ERROR logs", () => {
      const logs = ["[ERROR] Something went wrong"];
      render(<LiveScanConsole {...defaultProps} logs={logs} />);
      
      const logElement = screen.getByText("[ERROR] Something went wrong");
      expect(logElement).toHaveClass("text-red-400");
    });

    it("should colorize WARNING logs", () => {
      const logs = ["[WARN] Warning message"];
      render(<LiveScanConsole {...defaultProps} logs={logs} />);
      
      const logElement = screen.getByText("[WARN] Warning message");
      expect(logElement).toHaveClass("text-yellow-400");
    });

    it("should colorize INFO logs", () => {
      const logs = ["[INFO] Information message"];
      render(<LiveScanConsole {...defaultProps} logs={logs} />);
      
      const logElement = screen.getByText("[INFO] Information message");
      expect(logElement).toHaveClass("text-blue-400");
    });

    it("should colorize SUCCESS logs", () => {
      const logs = ["[SUCCESS] Operation completed"];
      render(<LiveScanConsole {...defaultProps} logs={logs} />);
      
      const logElement = screen.getByText("[SUCCESS] Operation completed");
      expect(logElement).toHaveClass("text-emerald-400");
    });
  });
});
