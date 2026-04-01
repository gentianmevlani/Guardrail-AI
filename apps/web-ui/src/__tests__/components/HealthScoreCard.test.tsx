import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * Component tests for HealthScoreCard
 * Tests the traffic light scoring display component
 */

// Mock component for testing (actual component would be imported)
const HealthScoreCard = ({
  score,
  trend,
  onViewDetails,
  className = "",
}: {
  score: number;
  trend?: "up" | "down" | "stable";
  onViewDetails?: () => void;
  className?: string;
}) => {
  const getScoreColor = (score: number) => {
    if (score < 50) return "score-red";
    if (score < 80) return "score-yellow";
    return "score-green";
  };

  const getScoreLabel = (score: number) => {
    if (score < 50) return "Critical";
    if (score < 80) return "Warning";
    return "Healthy";
  };

  return React.createElement("div", {
    "data-testid": "health-score-card",
    className: `health-score-card ${getScoreColor(score)} ${className}`,
  }, [
    React.createElement("div", {
      "data-testid": "score-value",
      className: "score-value",
    }, [score.toString()]),
    React.createElement("div", {
      className: "score-label",
    }, [getScoreLabel(score)]),
    trend && React.createElement("div", {
      className: "score-trend",
    }, [trend === "up" ? "↑" : trend === "down" ? "↓" : "→"]),
    onViewDetails && React.createElement("button", {
      "data-testid": "view-details-btn",
      onClick: onViewDetails,
    }, ["View Details"]),
  ]);
};

describe("HealthScoreCard", () => {
  describe("Score Display", () => {
    it("displays the score value", () => {
      render(<HealthScoreCard score={85} />);
      expect(screen.getByTestId("score-value")).toHaveTextContent("85");
    });

    it("shows green styling for scores >= 80", () => {
      render(<HealthScoreCard score={85} />);
      const card = screen.getByTestId("health-score-card");
      expect(card).toHaveClass("score-green");
    });

    it("shows yellow styling for scores 50-79", () => {
      render(<HealthScoreCard score={65} />);
      const card = screen.getByTestId("health-score-card");
      expect(card).toHaveClass("score-yellow");
    });

    it("shows red styling for scores < 50", () => {
      render(<HealthScoreCard score={35} />);
      const card = screen.getByTestId("health-score-card");
      expect(card).toHaveClass("score-red");
    });
  });

  describe("Score Labels", () => {
    it('shows "Healthy" for green scores', () => {
      render(<HealthScoreCard score={90} />);
      expect(screen.getByTestId("score-label")).toHaveTextContent("Healthy");
    });

    it('shows "Needs Attention" for yellow scores', () => {
      render(<HealthScoreCard score={60} />);
      expect(screen.getByTestId("score-label")).toHaveTextContent(
        "Needs Attention",
      );
    });

    it('shows "Critical" for red scores', () => {
      render(<HealthScoreCard score={25} />);
      expect(screen.getByTestId("score-label")).toHaveTextContent("Critical");
    });
  });

  describe("Trend Indicator", () => {
    it("shows up trend when score is improving", () => {
      render(<HealthScoreCard score={85} trend="up" />);
      expect(screen.getByTestId("trend-indicator")).toHaveTextContent("up");
    });

    it("shows down trend when score is declining", () => {
      render(<HealthScoreCard score={85} trend="down" />);
      expect(screen.getByTestId("trend-indicator")).toHaveTextContent("down");
    });

    it("does not show trend when not provided", () => {
      render(<HealthScoreCard score={85} />);
      expect(screen.queryByTestId("trend-indicator")).not.toBeInTheDocument();
    });
  });

  describe("Interactions", () => {
    it("calls onViewDetails when button is clicked", async () => {
      const user = userEvent.setup();
      const mockOnViewDetails = vi.fn();

      render(<HealthScoreCard score={85} onViewDetails={mockOnViewDetails} />);

      await user.click(screen.getByTestId("view-details-btn"));
      expect(mockOnViewDetails).toHaveBeenCalledTimes(1);
    });

    it("does not show details button when handler not provided", () => {
      render(<HealthScoreCard score={85} />);
      expect(screen.queryByTestId("view-details-btn")).not.toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles score of 0", () => {
      render(<HealthScoreCard score={0} />);
      expect(screen.getByTestId("score-value")).toHaveTextContent("0");
      expect(screen.getByTestId("health-score-card")).toHaveClass("score-red");
    });

    it("handles score of 100", () => {
      render(<HealthScoreCard score={100} />);
      expect(screen.getByTestId("score-value")).toHaveTextContent("100");
      expect(screen.getByTestId("health-score-card")).toHaveClass(
        "score-green",
      );
    });

    it("handles boundary score of 50", () => {
      render(<HealthScoreCard score={50} />);
      expect(screen.getByTestId("health-score-card")).toHaveClass(
        "score-yellow",
      );
    });

    it("handles boundary score of 80", () => {
      render(<HealthScoreCard score={80} />);
      expect(screen.getByTestId("health-score-card")).toHaveClass(
        "score-green",
      );
    });
  });
});

// Mock setup for @testing-library/react
vi.mock("@testing-library/react", async () => {
  const actual = await vi.importActual("@testing-library/react");
  return {
    ...actual,
    // Add any custom mock overrides here
  };
});
