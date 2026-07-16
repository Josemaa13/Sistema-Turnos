import { describe, expect, it } from "vitest";
import {
  BASE_PATTERNS,
  DAYS,
  validatePatternSet,
} from "@/domain/scheduling";

describe("patrones canónicos", () => {
  it("contiene 10 patrones válidos con dos libres y cinco jornadas", () => {
    expect(BASE_PATTERNS).toHaveLength(10);
    expect(validatePatternSet(BASE_PATTERNS)).toEqual([]);
    for (const pattern of BASE_PATTERNS) {
      expect(pattern.days.filter((day) => day.kind === "FREE")).toHaveLength(2);
      expect(pattern.days.filter((day) => day.kind !== "FREE")).toHaveLength(5);
    }
  });

  it("suma 29 mañanas, 21 tardes y 20 libres", () => {
    const days = BASE_PATTERNS.flatMap((pattern) => pattern.days);
    expect(days.filter((day) => day.kind === "MORNING")).toHaveLength(29);
    expect(days.filter((day) => day.kind === "AFTERNOON")).toHaveLength(21);
    expect(days.filter((day) => day.kind === "FREE")).toHaveLength(20);
  });

  it("suma las entradas semanales exactas", () => {
    const days = BASE_PATTERNS.flatMap((pattern) => pattern.days);
    expect(days.filter((day) => day.startTime === "05:30")).toHaveLength(6);
    expect(days.filter((day) => day.startTime === "07:00")).toHaveLength(7);
    expect(days.filter((day) => day.startTime === "08:00")).toHaveLength(16);
  });

  it("P07 y P08 vuelven de mañana; los demás vuelven de tarde", () => {
    for (const pattern of BASE_PATTERNS) {
      const freeIndices = pattern.days
        .map((day, index) => (day.kind === "FREE" ? index : -1))
        .filter((index) => index >= 0);
      const [first, second] = freeIndices;
      const start = first === 0 && second === 6 ? 6 : (first ?? 0);
      const returnShift = pattern.days[(start + 2) % DAYS.length];
      expect(returnShift?.kind).toBe(
        pattern.id === "P07" || pattern.id === "P08"
          ? "MORNING"
          : "AFTERNOON",
      );
    }
  });
});
