import {
  BASE_PATTERNS,
  generateCycle,
  isCycleWeekNumber,
  matchPatternByFreeDays,
  materializeWeek,
  type Day,
  type EmployeeId,
  type GeneratedCycle,
  type PatternId,
  type PatternMatchResult,
  type ScheduledShift,
  type WeekAssignment,
} from "@/domain/scheduling";
import type { ScheduleCycle } from "./models";

export function createCyclePreview(input: {
  readonly week1Assignment: WeekAssignment;
  readonly rotationOrder: readonly EmployeeId[];
}): GeneratedCycle {
  return generateCycle({ ...input, patterns: BASE_PATTERNS });
}

export function findPatternsForFreeDays(freeDays: readonly Day[]): PatternMatchResult {
  return matchPatternByFreeDays({ freeDays, patterns: BASE_PATTERNS });
}

export function assignEmployeeToPattern(
  assignment: WeekAssignment,
  patternId: PatternId,
  employeeId: EmployeeId,
): WeekAssignment {
  const previousEmployee = assignment[patternId];
  const previousPattern = Object.entries(assignment).find(
    ([, assignedEmployee]) => assignedEmployee === employeeId,
  )?.[0] as PatternId | undefined;
  if (!previousEmployee || !previousPattern || previousPattern === patternId) {
    return { ...assignment, [patternId]: employeeId };
  }
  return {
    ...assignment,
    [patternId]: employeeId,
    [previousPattern]: previousEmployee,
  };
}

export function materializeEffectiveWeek(
  cycle: ScheduleCycle,
  generated: GeneratedCycle,
  weekNumber: number,
): readonly (ScheduledShift & { readonly exceptionId?: string })[] {
  if (
    isCycleWeekNumber(weekNumber) &&
    cycle.clearedWeekNumbers.includes(weekNumber)
  ) {
    return [];
  }
  const week = generated.weeks.find((item) => item.weekNumber === weekNumber);
  if (!week) return [];
  const startsOn = new Date(`${cycle.startsOn}T00:00:00.000Z`);
  return materializeWeek(week, generated.patterns).map((shift) => {
    const dayIndex = [
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
      "SUNDAY",
    ].indexOf(shift.day);
    const date = new Date(startsOn);
    date.setUTCDate(startsOn.getUTCDate() + (weekNumber - 1) * 7 + dayIndex);
    const isoDate = date.toISOString().slice(0, 10);
    const exception = [...cycle.exceptions]
      .reverse()
      .find(
        (item) =>
          item.date === isoDate && item.employeeId === shift.employeeId,
      );
    return exception
      ? {
          ...shift,
          ...exception.replacement,
          exceptionId: exception.id,
        }
      : shift;
  });
}
