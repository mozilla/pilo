import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PiloLogo } from "../../../src/ui/components/icons/PiloLogo";

describe("PiloLogo", () => {
  it("renders an SVG element", () => {
    render(<PiloLogo />);

    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("accepts and applies className prop", () => {
    render(<PiloLogo className="custom-class w-10 h-10" />);

    const svg = document.querySelector("svg");
    expect(svg).toHaveClass("custom-class");
    expect(svg).toHaveClass("w-10");
    expect(svg).toHaveClass("h-10");
  });

  it("has appropriate accessibility attributes", () => {
    render(<PiloLogo />);

    const svg = document.querySelector("svg");
    expect(svg).toHaveAttribute("aria-label", "Pilo logo");
    expect(svg).toHaveAttribute("role", "img");
  });

  it("renders with default size when no className provided", () => {
    render(<PiloLogo />);

    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
    // Should have viewBox for proper scaling
    expect(svg).toHaveAttribute("viewBox");
  });
});
