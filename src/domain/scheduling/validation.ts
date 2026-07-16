import { EXPECTED_DAILY_COVERAGE, validatePatternSet } from "./pattern-validation";
import { rotateEmployee } from "./rotation";
import { materializeWeek } from "./schedule";
import { DAYS, type GeneratedCycle, type ValidationIssue } from "./types";

function error(
  code: string,
  message: string,
  context: Omit<ValidationIssue, "code" | "severity" | "message"> = {},
): ValidationIssue {
  return { code, severity: "ERROR", message, ...context };
}

export function validateCycle(cycle: GeneratedCycle): ValidationIssue[] {
  const issues: ValidationIssue[] = [...validatePatternSet(cycle.patterns)];
  const expectedPatternIds = cycle.patterns.map((pattern) => pattern.id);
  const expectedEmployees = new Set(cycle.rotationOrder);

  if (cycle.weeks.length !== 10) {
    issues.push(
      error(
        "CYCLE_WEEK_COUNT",
        `El ciclo debe contener 10 semanas; contiene ${cycle.weeks.length}.`,
      ),
    );
  }
  if (cycle.rotationOrder.length !== 10 || expectedEmployees.size !== 10) {
    issues.push(
      error(
        "INVALID_ROTATION_ORDER",
        "El ciclo debe utilizar un orden de rotación de 10 empleados únicos.",
      ),
    );
    return issues;
  }

  const week1 = cycle.weeks.find((week) => week.weekNumber === 1);
  for (const week of cycle.weeks) {
    const assignmentKeys = Object.keys(week.assignments);
    const assignedEmployees = Object.values(week.assignments);
    if (
      assignmentKeys.length !== expectedPatternIds.length ||
      expectedPatternIds.some((patternId) => !(patternId in week.assignments))
    ) {
      issues.push(
        error(
          "INCOMPLETE_WEEK_ASSIGNMENT",
          `Semana ${week.weekNumber}: cada patrón debe estar asignado exactamente una vez.`,
          { weekNumber: week.weekNumber },
        ),
      );
    }
    if (new Set(assignedEmployees).size !== assignedEmployees.length) {
      issues.push(
        error(
          "DUPLICATE_EMPLOYEE_ASSIGNMENT",
          `Semana ${week.weekNumber}: un empleado está asignado a más de un patrón.`,
          { weekNumber: week.weekNumber },
        ),
      );
    }
    for (const employeeId of cycle.rotationOrder) {
      if (!assignedEmployees.includes(employeeId)) {
        issues.push(
          error(
            "MISSING_EMPLOYEE_ASSIGNMENT",
            `Semana ${week.weekNumber}: falta el empleado ${employeeId}.`,
            { weekNumber: week.weekNumber, employeeId },
          ),
        );
      }
    }

    if (week1) {
      for (const patternId of expectedPatternIds) {
        const initialEmployee = week1.assignments[patternId];
        if (!initialEmployee) continue;
        const expectedEmployee = rotateEmployee(
          initialEmployee,
          week.weekNumber - 1,
          cycle.rotationOrder,
        );
        if (week.assignments[patternId] !== expectedEmployee) {
          issues.push(
            error(
              "ROTATION_MISMATCH",
              `Semana ${week.weekNumber}: ${patternId} debe asignarse a ${expectedEmployee}.`,
              { weekNumber: week.weekNumber, patternId },
            ),
          );
        }
      }
    }

    const shifts = materializeWeek(week, cycle.patterns);
    for (const day of DAYS) {
      const dayShifts = shifts.filter((shift) => shift.day === day);
      const employeeIds = dayShifts.map((shift) => shift.employeeId);
      if (employeeIds.length !== 10 || new Set(employeeIds).size !== 10) {
        issues.push(
          error(
            "DAILY_EMPLOYEE_COVERAGE",
            `Semana ${week.weekNumber}, ${day}: cada empleado debe aparecer exactamente una vez.`,
            { weekNumber: week.weekNumber, day },
          ),
        );
      }
      const expected = EXPECTED_DAILY_COVERAGE[day];
      const counts = {
        free: dayShifts.filter((shift) => shift.kind === "FREE").length,
        morning: dayShifts.filter((shift) => shift.kind === "MORNING").length,
        afternoon: dayShifts.filter((shift) => shift.kind === "AFTERNOON").length,
      };
      if (
        counts.free !== expected.free ||
        counts.morning !== expected.morning ||
        counts.afternoon !== expected.afternoon
      ) {
        issues.push(
          error(
            "DAILY_SHIFT_COVERAGE",
            `Semana ${week.weekNumber}, ${day}: se requieren ${expected.free} libres, ${expected.morning} mañanas y ${expected.afternoon} tardes.`,
            { weekNumber: week.weekNumber, day },
          ),
        );
      }
      for (const start of ["05:30", "07:00", "08:00"] as const) {
        const actual = dayShifts.filter((shift) => shift.startTime === start).length;
        if (actual !== expected.starts[start]) {
          issues.push(
            error(
              "DAILY_START_TIME_COVERAGE",
              `Semana ${week.weekNumber}, ${day}: se requieren ${expected.starts[start]} entradas a las ${start}; hay ${actual}.`,
              { weekNumber: week.weekNumber, day },
            ),
          );
        }
      }
    }
  }

  const allShifts = cycle.weeks.flatMap((week) => materializeWeek(week, cycle.patterns));
  for (const employeeId of cycle.rotationOrder) {
    const employeeShifts = allShifts.filter((shift) => shift.employeeId === employeeId);
    const expectedTotals = {
      MORNING: 29,
      AFTERNOON: 21,
      FREE: 20,
      "05:30": 6,
      "07:00": 7,
      "08:00": 16,
    } as const;
    for (const kind of ["MORNING", "AFTERNOON", "FREE"] as const) {
      const actual = employeeShifts.filter((shift) => shift.kind === kind).length;
      if (actual !== expectedTotals[kind]) {
        issues.push(
          error(
            "EMPLOYEE_CYCLE_SHIFT_TOTAL",
            `${employeeId} debe tener ${expectedTotals[kind]} turnos ${kind} por ciclo; tiene ${actual}.`,
            { employeeId },
          ),
        );
      }
    }
    for (const start of ["05:30", "07:00", "08:00"] as const) {
      const actual = employeeShifts.filter((shift) => shift.startTime === start).length;
      if (actual !== expectedTotals[start]) {
        issues.push(
          error(
            "EMPLOYEE_CYCLE_START_TOTAL",
            `${employeeId} debe entrar ${expectedTotals[start]} veces a las ${start}; tiene ${actual}.`,
            { employeeId },
          ),
        );
      }
    }
  }

  if (week1) {
    for (const patternId of expectedPatternIds) {
      const initialEmployee = week1.assignments[patternId];
      if (
        initialEmployee &&
        rotateEmployee(initialEmployee, 10, cycle.rotationOrder) !== initialEmployee
      ) {
        issues.push(
          error(
            "CYCLE_DOES_NOT_CLOSE",
            `Semana 11 no devuelve ${patternId} a su empleado de Semana 1.`,
            { patternId },
          ),
        );
      }
    }
  }

  const orderedWeeks = [...cycle.weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  orderedWeeks.forEach((week, index) => {
    const shifts = materializeWeek(week, cycle.patterns);
    const saturday = shifts.find(
      (shift) => shift.day === "SATURDAY" && shift.startTime === "07:00",
    );
    const sunday = shifts.find(
      (shift) => shift.day === "SUNDAY" && shift.startTime === "07:00",
    );
    const nextWeek = orderedWeeks[(index + 1) % orderedWeeks.length];
    const nextMonday = nextWeek
      ? materializeWeek(nextWeek, cycle.patterns).find(
          (shift) => shift.day === "MONDAY" && shift.startTime === "05:30",
        )
      : undefined;
    if (
      !saturday ||
      !sunday ||
      !nextMonday ||
      saturday.employeeId !== sunday.employeeId ||
      sunday.employeeId !== nextMonday.employeeId
    ) {
      issues.push(
        error(
          "WEEKEND_MORNING_CHAIN",
          `Semana ${week.weekNumber}: la persona de sábado y domingo a las 07:00 debe cubrir el lunes siguiente a las 05:30.`,
          { weekNumber: week.weekNumber },
        ),
      );
    }
  });

  return issues;
}
