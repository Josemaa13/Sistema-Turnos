import {
  BASE_PATTERNS,
  generateCycle,
  normalizeClearedWeekNumbers,
  validateCycle,
  type CycleWeekNumber,
  type EmployeeId,
  type WeekAssignment,
} from "@/domain/scheduling";
import { InvalidCycleDateError } from "./errors";
import { parseIsoDate } from "./cycle-helpers";
import type { ScheduleCycle } from "./models";
import {
  DEFAULT_SERVICES,
  type ApplicationServices,
  type ScheduleRepository,
} from "./ports";

export interface CreateCycleInput {
  readonly startsOn: string;
  readonly week1Assignment: WeekAssignment;
  readonly rotationOrder: readonly EmployeeId[];
  readonly clearedWeekNumbers?: readonly CycleWeekNumber[];
  readonly templateId?: string;
}

export async function createCycle(
  input: CreateCycleInput,
  repository: ScheduleRepository,
  services: ApplicationServices = DEFAULT_SERVICES,
): Promise<ScheduleCycle> {
  const startsOn = parseIsoDate(input.startsOn);
  if (!startsOn) {
    throw new InvalidCycleDateError(
      "La fecha de inicio debe usar el formato ISO YYYY-MM-DD.",
    );
  }
  if (startsOn.getUTCDay() !== 1) {
    throw new InvalidCycleDateError(
      "La Semana 1 debe comenzar en lunes.",
    );
  }

  const clearedWeekNumbers = normalizeClearedWeekNumbers(input.clearedWeekNumbers);
  const generated = generateCycle({
    week1Assignment: input.week1Assignment,
    patterns: BASE_PATTERNS,
    rotationOrder: input.rotationOrder,
  });
  const issues = validateCycle(generated).filter((issue) => issue.severity === "ERROR");
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join(" "));
  }

  const timestamp = services.now();
  const cycle: ScheduleCycle = {
    id: services.createId(),
    templateId: input.templateId ?? "restaurant-base-v1",
    startsOn: input.startsOn,
    status: "DRAFT",
    week1Assignment: input.week1Assignment,
    clearedWeekNumbers,
    rotationOrder: input.rotationOrder,
    patternIds: BASE_PATTERNS.map((pattern) => pattern.id),
    exceptions: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await repository.saveCycle(cycle);
  return cycle;
}
