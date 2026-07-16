import { describe, expect, it } from "vitest";
import { BASE_PATTERNS, matchPatternByFreeDays } from "@/domain/scheduling";

describe("matcher por descansos", () => {
  it("encuentra P01 de forma única para lunes-martes", () => {
    expect(
      matchPatternByFreeDays({
        freeDays: ["MONDAY", "TUESDAY"],
        patterns: BASE_PATTERNS,
      }),
    ).toEqual({ kind: "UNIQUE", patternId: "P01" });
  });

  it("devuelve opciones cuando dos patrones comparten descanso", () => {
    const result = matchPatternByFreeDays({
      freeDays: ["TUESDAY", "WEDNESDAY"],
      patterns: BASE_PATTERNS,
    });
    expect(result.kind).toBe("AMBIGUOUS");
    if (result.kind === "AMBIGUOUS") {
      expect(result.candidates.map((candidate) => candidate.patternId)).toEqual([
        "P02",
        "P07",
      ]);
      expect(result.candidates[1]?.tags).toContain("SPECIAL_TUE_WED");
    }
  });

  it("explica una combinación inexistente", () => {
    const result = matchPatternByFreeDays({
      freeDays: ["MONDAY", "WEDNESDAY"],
      patterns: BASE_PATTERNS,
    });
    expect(result.kind).toBe("NONE");
    if (result.kind === "NONE") expect(result.reason).toContain("No existe");
  });
});
