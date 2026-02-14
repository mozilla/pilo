import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SparkLogo } from "../../../src/components/icons/SparkLogo.js";

describe("SparkLogo", () => {
  it("renders an SVG element", () => {
    render(<SparkLogo />);

    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("accepts and applies className prop", () => {
    render(<SparkLogo className="custom-class w-10 h-10" />);

    const svg = document.querySelector("svg");
    expect(svg).toHaveClass("custom-class");
    expect(svg).toHaveClass("w-10");
    expect(svg).toHaveClass("h-10");
  });

  it("has appropriate accessibility attributes", () => {
    render(<SparkLogo />);

    const svg = document.querySelector("svg");
    expect(svg).toHaveAttribute("aria-label", "Spark logo");
    expect(svg).toHaveAttribute("role", "img");
  });

  it("renders with default size when no className provided", () => {
    render(<SparkLogo />);

    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
    // Should have viewBox for proper scaling
    expect(svg).toHaveAttribute("viewBox");
  });
});
