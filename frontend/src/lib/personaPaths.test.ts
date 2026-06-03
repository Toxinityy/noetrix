import { describe, it, expect } from "vitest";
import { PERSONA_PATHS } from "./personaPaths";
import { TOURS, TOUR_PAGES } from "@/components/tour/steps";

describe("PERSONA_PATHS", () => {
  it("has exactly the three personas", () => {
    expect(PERSONA_PATHS.map((p) => p.id)).toEqual(["earn", "alpha", "build"]);
  });

  it("every path points at a real tour whose page matches its href", () => {
    for (const p of PERSONA_PATHS) {
      expect(TOURS[p.tourId]?.length ?? 0).toBeGreaterThan(0);
      expect(TOUR_PAGES[p.tourId]).toBe(p.href);
    }
  });

  it("every path has a non-empty label and blurb", () => {
    for (const p of PERSONA_PATHS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.blurb.length).toBeGreaterThan(0);
    }
  });
});
