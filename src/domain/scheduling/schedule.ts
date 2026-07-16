import type {
  Day,
  GeneratedCycle,
  GeneratedWeek,
  ScheduledShift,
  ShiftPattern,
} from "./types";

export function materializeWeek(
  week: GeneratedWeek,
  patterns: readonly ShiftPattern[],
): readonly ScheduledShift[] {
  return patterns.flatMap((pattern) => {
    const employeeId = week.assignments[pattern.id];
    if (!employeeId) return [];
    return pattern.days.map((value) => ({
      ...value,
      weekNumber: week.weekNumber,
      patternId: pattern.id,
      employeeId,
    }));
  });
}

export function getWeek(
  cycle: GeneratedCycle,
  weekNumber: number,
): GeneratedWeek | undefined {
  return cycle.weeks.find((week) => week.weekNumber === weekNumber);
}

export function getDaySchedule(
  cycle: GeneratedCycle,
  weekNumber: number,
  day: Day,
): readonly ScheduledShift[] {
  const week = getWeek(cycle, weekNumber);
  return week
    ? materializeWeek(week, cycle.patterns).filter((shift) => shift.day === day)
    : [];
}
