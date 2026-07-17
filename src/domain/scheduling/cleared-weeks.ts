import { CYCLE_WEEK_NUMBERS, type CycleWeekNumber } from "./types";

const VALID_WEEK_NUMBERS = new Set<number>(CYCLE_WEEK_NUMBERS);

export function isCycleWeekNumber(value: unknown): value is CycleWeekNumber {
  return typeof value === "number" && Number.isInteger(value) && VALID_WEEK_NUMBERS.has(value);
}

export function normalizeClearedWeekNumbers(
  value: unknown,
): readonly CycleWeekNumber[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isCycleWeekNumber))].sort((left, right) => left - right);
}
