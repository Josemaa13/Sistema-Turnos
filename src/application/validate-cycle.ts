import { validateCycle, type ValidationIssue } from "@/domain/scheduling";
import { generateStoredCycle } from "./cycle-helpers";
import { CycleNotFoundError } from "./errors";
import type { ScheduleCycle } from "./models";
import {
  DEFAULT_SERVICES,
  type ApplicationServices,
  type ScheduleRepository,
} from "./ports";

export interface ValidateCycleResult {
  readonly cycle: ScheduleCycle;
  readonly issues: readonly ValidationIssue[];
}

export async function validateStoredCycle(
  cycleId: string,
  repository: ScheduleRepository,
  services: ApplicationServices = DEFAULT_SERVICES,
): Promise<ValidateCycleResult> {
  const stored = await repository.findCycle(cycleId);
  if (!stored) throw new CycleNotFoundError(cycleId);
  const issues: ValidationIssue[] = [
    ...validateCycle(generateStoredCycle(stored)),
    ...stored.exceptions.map((item) => ({
      code: "MANUAL_EXCEPTION",
      severity: "WARNING" as const,
      message: `${item.date}: ${item.employeeId} tiene una excepción manual (${item.reason}).`,
      employeeId: item.employeeId,
    })),
  ];
  const hasErrors = issues.some((issue) => issue.severity === "ERROR");
  const cycle: ScheduleCycle = {
    ...stored,
    status: hasErrors ? "DRAFT" : "VALIDATED",
    updatedAt: services.now(),
  };
  await repository.saveCycle(cycle);
  return { cycle, issues };
}
