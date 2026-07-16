import { DAYS, type Day, type PatternMatchResult, type PatternPreview, type ShiftPattern } from "./types";

function sameDaySet(left: readonly Day[], right: readonly Day[]): boolean {
  return left.length === right.length && left.every((day) => right.includes(day));
}

function preview(pattern: ShiftPattern): PatternPreview {
  const freeIndices = pattern.days
    .map((value, index) => (value.kind === "FREE" ? index : -1))
    .filter((index) => index >= 0);
  const [first, second] = freeIndices;
  const restStart = first === 0 && second === 6 ? 6 : (first ?? 0);
  const returnShift = pattern.days[(restStart + 2) % DAYS.length];
  if (!returnShift) throw new Error(`No se pudo calcular el regreso de ${pattern.id}.`);
  return {
    patternId: pattern.id,
    freeDays: pattern.days
      .filter((value) => value.kind === "FREE")
      .map((value) => value.day),
    sequence: pattern.days,
    returnShift,
    tags: pattern.tags,
  };
}

export function matchPatternByFreeDays(input: {
  readonly freeDays: readonly Day[];
  readonly patterns: readonly ShiftPattern[];
}): PatternMatchResult {
  if (
    input.freeDays.length !== 2 ||
    new Set(input.freeDays).size !== 2 ||
    input.freeDays.some((day) => !DAYS.includes(day))
  ) {
    return {
      kind: "NONE",
      reason: "Selecciona exactamente dos días libres distintos.",
    };
  }
  const candidates = input.patterns.filter((pattern) =>
    sameDaySet(
      input.freeDays,
      pattern.days
        .filter((value) => value.kind === "FREE")
        .map((value) => value.day),
    ),
  );
  if (candidates.length === 0) {
    return {
      kind: "NONE",
      reason: "No existe un patrón con ese bloque exacto de descanso.",
    };
  }
  if (candidates.length === 1) {
    const candidate = candidates[0];
    if (!candidate) throw new Error("No se pudo recuperar el patrón compatible.");
    return { kind: "UNIQUE", patternId: candidate.id };
  }
  return { kind: "AMBIGUOUS", candidates: candidates.map(preview) };
}
