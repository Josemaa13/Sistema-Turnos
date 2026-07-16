import {
  DAYS,
  materializeWeek,
  type EmployeeId,
  type PatternDay,
  type ScheduleException,
} from "@/domain/scheduling";
import { generateStoredCycle, parseIsoDate } from "./cycle-helpers";
import {
  CycleNotFoundError,
  InvalidExceptionError,
} from "./errors";
import type { ScheduleCycle } from "./models";
import {
  DEFAULT_SERVICES,
  type ApplicationServices,
  type ScheduleRepository,
} from "./ports";

export interface ApplyExceptionInput {
  readonly cycleId: string;
  readonly date: string;
  readonly employeeId: EmployeeId;
  readonly replacement: PatternDay;
  readonly reason: string;
  readonly createdBy: string;
}

export interface ApplyExceptionResult {
  readonly cycle: ScheduleCycle;
  readonly exception: ScheduleException;
  readonly warning: string;
}

export async function applyException(
  input: ApplyExceptionInput,
  repository: ScheduleRepository,
  services: ApplicationServices = DEFAULT_SERVICES,
): Promise<ApplyExceptionResult> {
  const cycle = await repository.findCycle(input.cycleId);
  if (!cycle) throw new CycleNotFoundError(input.cycleId);
  if (input.reason.trim().length < 3) {
    throw new InvalidExceptionError(
      "La excepción debe incluir un motivo explicable de al menos tres caracteres.",
    );
  }
  const targetDate = parseIsoDate(input.date);
  const startsOn = parseIsoDate(cycle.startsOn);
  if (!targetDate || !startsOn) {
    throw new InvalidExceptionError("La excepción debe usar una fecha ISO válida.");
  }
  const dayOffset = Math.round(
    (targetDate.valueOf() - startsOn.valueOf()) / 86_400_000,
  );
  if (dayOffset < 0 || dayOffset >= 70) {
    throw new InvalidExceptionError(
      "La fecha de la excepción debe pertenecer a las 10 semanas del ciclo.",
    );
  }
  const day = DAYS[dayOffset % 7];
  const weekNumber = Math.floor(dayOffset / 7) + 1;
  if (!day || input.replacement.day !== day) {
    throw new InvalidExceptionError(
      "El día de la sustitución no coincide con la fecha seleccionada.",
    );
  }

  const generated = generateStoredCycle(cycle);
  const week = generated.weeks.find((item) => item.weekNumber === weekNumber);
  const originalShift = week
    ? materializeWeek(week, generated.patterns).find(
        (shift) => shift.employeeId === input.employeeId && shift.day === day,
      )
    : undefined;
  if (!originalShift) {
    throw new InvalidExceptionError(
      `No se encontró el turno original de ${input.employeeId} en la fecha indicada.`,
    );
  }
  const original: PatternDay =
    originalShift.kind === "MORNING"
      ? { day, kind: "MORNING", startTime: originalShift.startTime }
      : { day, kind: originalShift.kind, startTime: null };
  const timestamp = services.now();
  const scheduleException: ScheduleException = {
    id: services.createId(),
    cycleId: cycle.id,
    date: input.date,
    employeeId: input.employeeId,
    original,
    replacement: input.replacement,
    reason: input.reason.trim(),
    createdBy: input.createdBy,
    createdAt: timestamp,
  };
  const updated: ScheduleCycle = {
    ...cycle,
    exceptions: [...cycle.exceptions, scheduleException],
    updatedAt: timestamp,
  };
  await repository.saveCycle(updated);
  return {
    cycle: updated,
    exception: scheduleException,
    warning:
      "Excepción manual registrada. Revisa la cobertura del día antes de publicar una nueva versión.",
  };
}
