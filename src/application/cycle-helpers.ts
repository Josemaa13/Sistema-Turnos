import { BASE_PATTERNS, generateCycle, type GeneratedCycle } from "@/domain/scheduling";
import type { ScheduleCycle } from "./models";

export function generateStoredCycle(cycle: ScheduleCycle): GeneratedCycle {
  const patternIdSet = new Set(cycle.patternIds);
  const patterns = BASE_PATTERNS.filter((pattern) => patternIdSet.has(pattern.id));
  return generateCycle({
    week1Assignment: cycle.week1Assignment,
    rotationOrder: cycle.rotationOrder,
    patterns,
  });
}

export function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}
