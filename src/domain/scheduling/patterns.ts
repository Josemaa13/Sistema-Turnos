import {
  DAYS,
  type MorningStart,
  type PatternDay,
  type PatternId,
  type PatternTag,
  type ShiftPattern,
} from "./types";

export type PatternToken = "F" | "A" | `M${"05_30" | "07_00" | "08_00"}`;

const TOKEN_TO_START: Readonly<Record<Exclude<PatternToken, "F" | "A">, MorningStart>> = {
  M05_30: "05:30",
  M07_00: "07:00",
  M08_00: "08:00",
};

function tokenToPatternDay(
  token: PatternToken,
  dayIndex: number,
): PatternDay {
  const day = DAYS[dayIndex];
  if (!day) {
    throw new Error(`No existe un día canónico en la posición ${dayIndex}.`);
  }
  if (token === "F") return { day, kind: "FREE", startTime: null };
  if (token === "A") return { day, kind: "AFTERNOON", startTime: null };
  return { day, kind: "MORNING", startTime: TOKEN_TO_START[token] };
}

export function pattern(
  id: PatternId,
  tokens: readonly PatternToken[],
  tags: readonly Exclude<PatternTag, "STANDARD">[] = [],
): ShiftPattern {
  if (tokens.length !== DAYS.length) {
    throw new Error(`El patrón ${id} debe contener exactamente siete días.`);
  }
  return {
    id,
    days: tokens.map(tokenToPatternDay),
    tags: tags.length > 0 ? tags : ["STANDARD"],
  };
}

export const BASE_PATTERNS: readonly ShiftPattern[] = [
  pattern("P01", ["F", "F", "A", "A", "A", "M08_00", "M08_00"]),
  pattern("P02", ["M08_00", "F", "F", "A", "A", "A", "M08_00"]),
  pattern("P03", ["M07_00", "M05_30", "F", "F", "A", "A", "A"]),
  pattern("P04", ["M08_00", "M07_00", "M05_30", "F", "F", "A", "A"]),
  pattern("P05", ["M08_00", "M08_00", "M07_00", "M05_30", "F", "F", "A"]),
  pattern("P06", ["A", "M08_00", "M08_00", "M07_00", "M05_30", "F", "F"]),
  pattern(
    "P07",
    ["M05_30", "F", "F", "M08_00", "M07_00", "M08_00", "M08_00"],
    ["SPECIAL_TUE_WED"],
  ),
  pattern(
    "P08",
    ["A", "A", "M08_00", "F", "F", "M07_00", "M07_00"],
    ["SPECIAL_THU_FRI"],
  ),
  pattern("P09", ["A", "A", "A", "M08_00", "M08_00", "F", "F"]),
  pattern("P10", ["F", "A", "A", "A", "M08_00", "M05_30", "F"]),
] as const;
