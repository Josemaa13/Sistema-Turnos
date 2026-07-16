import {
  InvalidPatternSetError,
  InvalidWeekAssignmentError,
} from "./errors";
import { validatePatternSet } from "./pattern-validation";
import { rotateEmployee, validateRotationOrder } from "./rotation";
import type {
  EmployeeId,
  GeneratedCycle,
  GeneratedWeek,
  PatternId,
  ShiftPattern,
  WeekAssignment,
} from "./types";

export interface GenerateCycleInput {
  readonly week1Assignment: WeekAssignment;
  readonly patterns: readonly ShiftPattern[];
  readonly rotationOrder: readonly EmployeeId[];
}

export function validateWeek1Assignment(input: GenerateCycleInput): void {
  validateRotationOrder(input.rotationOrder);
  const patternIssues = validatePatternSet(input.patterns);
  if (patternIssues.length > 0) {
    throw new InvalidPatternSetError(patternIssues[0]?.message ?? "La plantilla no es válida.");
  }

  const expectedPatternIds = input.patterns.map((pattern) => pattern.id);
  const assignedPatternIds = Object.keys(input.week1Assignment) as PatternId[];
  if (
    assignedPatternIds.length !== expectedPatternIds.length ||
    expectedPatternIds.some((patternId) => !(patternId in input.week1Assignment))
  ) {
    throw new InvalidWeekAssignmentError(
      "La Semana 1 debe asignar exactamente un empleado a cada uno de los 10 patrones.",
    );
  }

  const assignedEmployees = Object.values(input.week1Assignment);
  if (new Set(assignedEmployees).size !== assignedEmployees.length) {
    throw new InvalidWeekAssignmentError(
      "La Semana 1 no puede asignar un empleado a más de un patrón.",
    );
  }
  const rotationEmployees = new Set(input.rotationOrder);
  if (
    assignedEmployees.some((employeeId) => !rotationEmployees.has(employeeId)) ||
    input.rotationOrder.some((employeeId) => !assignedEmployees.includes(employeeId))
  ) {
    throw new InvalidWeekAssignmentError(
      "Los empleados asignados deben coincidir exactamente con el orden de rotación.",
    );
  }
}

export function generateWeek(
  week1Assignment: WeekAssignment,
  weekNumber: number,
  rotationOrder: readonly EmployeeId[],
): GeneratedWeek {
  if (!Number.isInteger(weekNumber) || weekNumber < 1) {
    throw new RangeError("El número de semana debe ser un entero positivo.");
  }
  const assignments = Object.fromEntries(
    Object.entries(week1Assignment).map(([patternId, employeeId]) => [
      patternId,
      rotateEmployee(employeeId, weekNumber - 1, rotationOrder),
    ]),
  ) as WeekAssignment;
  return { weekNumber, assignments };
}

export function generateCycle(input: GenerateCycleInput): GeneratedCycle {
  validateWeek1Assignment(input);
  return {
    patterns: input.patterns,
    rotationOrder: input.rotationOrder,
    weeks: Array.from({ length: 10 }, (_, index) =>
      generateWeek(input.week1Assignment, index + 1, input.rotationOrder),
    ),
  };
}
