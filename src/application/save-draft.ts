import {
  BASE_PATTERNS,
  generateCycle,
  normalizeClearedWeekNumbers,
  validateCycle,
  type CycleWeekNumber,
  type EmployeeId,
  type ScheduleException,
  type WeekAssignment,
} from "@/domain/scheduling";
import { createCycle } from "./create-cycle";
import { CycleNotFoundError } from "./errors";
import type { ScheduleCycle } from "./models";
import {
  DEFAULT_SERVICES,
  type ApplicationServices,
  type ScheduleRepository,
} from "./ports";

export interface SaveDraftInput {
  readonly cycleId?: string;
  readonly startsOn: string;
  readonly week1Assignment: WeekAssignment;
  readonly rotationOrder: readonly EmployeeId[];
  readonly clearedWeekNumbers?: readonly CycleWeekNumber[];
  readonly exceptions?: readonly ScheduleException[];
}

function assignmentsEqual(left: WeekAssignment, right: WeekAssignment): boolean {
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => left[key as keyof WeekAssignment] === right[key as keyof WeekAssignment])
  );
}

function weekNumbersEqual(
  left: readonly CycleWeekNumber[],
  right: readonly CycleWeekNumber[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export async function saveCycleDraft(
  input: SaveDraftInput,
  repository: ScheduleRepository,
  services: ApplicationServices = DEFAULT_SERVICES,
): Promise<ScheduleCycle> {
  if (!input.cycleId) {
    return createCycle(input, repository, services);
  }
  const existing = await repository.findCycle(input.cycleId);
  if (!existing) throw new CycleNotFoundError(input.cycleId);

  const clearedWeekNumbers =
    input.clearedWeekNumbers === undefined
      ? existing.clearedWeekNumbers
      : normalizeClearedWeekNumbers(input.clearedWeekNumbers);

  const changedMaster =
    existing.startsOn !== input.startsOn ||
    !assignmentsEqual(existing.week1Assignment, input.week1Assignment) ||
    !weekNumbersEqual(existing.clearedWeekNumbers, clearedWeekNumbers) ||
    existing.rotationOrder.some(
      (employeeId, index) => input.rotationOrder[index] !== employeeId,
    );
  if (existing.status === "PUBLISHED" && changedMaster) {
    return createCycle(
      {
        startsOn: input.startsOn,
        week1Assignment: input.week1Assignment,
        rotationOrder: input.rotationOrder,
        clearedWeekNumbers,
        templateId: existing.templateId,
      },
      repository,
      services,
    );
  }

  const generated = generateCycle({
    week1Assignment: input.week1Assignment,
    rotationOrder: input.rotationOrder,
    patterns: BASE_PATTERNS,
  });
  const blocking = validateCycle(generated).filter((item) => item.severity === "ERROR");
  if (blocking.length > 0) throw new Error(blocking.map((item) => item.message).join(" "));
  const updated: ScheduleCycle = {
    ...existing,
    startsOn: input.startsOn,
    week1Assignment: input.week1Assignment,
    clearedWeekNumbers,
    rotationOrder: input.rotationOrder,
    exceptions: input.exceptions ?? existing.exceptions,
    status: changedMaster ? "DRAFT" : existing.status,
    updatedAt: services.now(),
  };
  await repository.saveCycle(updated);
  return updated;
}
