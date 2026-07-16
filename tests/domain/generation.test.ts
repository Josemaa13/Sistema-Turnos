import { describe, expect, it } from "vitest";
import {
  BASE_PATTERNS,
  DAYS,
  HISTORICAL_EMPLOYEE_NAMES,
  InvalidRotationOrderError,
  UnknownEmployeeError,
  WEEK_1_ASSIGNMENT,
  generateCycle,
  generateWeek,
  getDaySchedule,
  materializeWeek,
  rotateEmployee,
  validateCycle,
} from "@/domain/scheduling";

const cycle = generateCycle({
  week1Assignment: WEEK_1_ASSIGNMENT,
  patterns: BASE_PATTERNS,
  rotationOrder: HISTORICAL_EMPLOYEE_NAMES,
});

describe("generación determinista", () => {
  it("reproduce la Semana 1 canónica", () => {
    const expected = {
      MONDAY: {
        FREE: ["JUANA", "ROE"],
        MORNING: ["ROCIO 05:30", "MARIA 07:00", "ISA 08:00", "LUCIA 08:00", "RO 08:00"],
        AFTERNOON: ["ANA", "NATALIA", "SOSA"],
      },
      TUESDAY: {
        FREE: ["ISA", "ROCIO", "ROE"],
        MORNING: ["MARIA 05:30", "RO 07:00", "LUCIA 08:00", "SOSA 08:00"],
        AFTERNOON: ["ANA", "JUANA", "NATALIA"],
      },
      WEDNESDAY: {
        FREE: ["ISA", "MARIA", "ROCIO"],
        MORNING: ["RO 05:30", "LUCIA 07:00", "ANA 08:00", "SOSA 08:00"],
        AFTERNOON: ["JUANA", "NATALIA", "ROE"],
      },
      THURSDAY: {
        FREE: ["ANA", "MARIA", "RO"],
        MORNING: ["LUCIA 05:30", "SOSA 07:00", "NATALIA 08:00", "ROCIO 08:00"],
        AFTERNOON: ["ISA", "JUANA", "ROE"],
      },
      FRIDAY: {
        FREE: ["ANA", "LUCIA", "RO"],
        MORNING: ["SOSA 05:30", "ROCIO 07:00", "JUANA 08:00", "NATALIA 08:00"],
        AFTERNOON: ["ISA", "MARIA", "ROE"],
      },
      SATURDAY: {
        FREE: ["LUCIA", "NATALIA", "SOSA"],
        MORNING: ["JUANA 05:30", "ANA 07:00", "ROCIO 08:00", "ROE 08:00"],
        AFTERNOON: ["ISA", "MARIA", "RO"],
      },
      SUNDAY: {
        FREE: ["JUANA", "NATALIA", "SOSA"],
        MORNING: ["ANA 07:00", "ISA 08:00", "ROCIO 08:00", "ROE 08:00"],
        AFTERNOON: ["LUCIA", "MARIA", "RO"],
      },
    } as const;

    for (const day of DAYS) {
      const shifts = getDaySchedule(cycle, 1, day);
      const actual = {
        FREE: shifts
          .filter((shift) => shift.kind === "FREE")
          .map((shift) => shift.employeeId)
          .sort(),
        MORNING: shifts
          .filter((shift) => shift.kind === "MORNING")
          .map((shift) => `${shift.employeeId} ${shift.startTime}`)
          .sort(),
        AFTERNOON: shifts
          .filter((shift) => shift.kind === "AFTERNOON")
          .map((shift) => shift.employeeId)
          .sort(),
      };
      expect(actual).toEqual({
        FREE: [...expected[day].FREE].sort(),
        MORNING: [...expected[day].MORNING].sort(),
        AFTERNOON: [...expected[day].AFTERNOON].sort(),
      });
    }
  });

  it("avanza una posición en Semana 2 y nueve en Semana 10", () => {
    expect(cycle.weeks[1]?.assignments.P01).toBe("ISA");
    expect(cycle.weeks[9]?.assignments.P01).toBe("JUANA");
    expect(cycle.weeks[9]?.assignments.P02).toBe("ROE");
  });

  it("Semana 11 coincide exactamente con Semana 1", () => {
    const week11 = generateWeek(
      WEEK_1_ASSIGNMENT,
      11,
      HISTORICAL_EMPLOYEE_NAMES,
    );
    expect(week11.assignments).toEqual(WEEK_1_ASSIGNMENT);
  });

  it("reparte a cada empleado los totales exactos del ciclo", () => {
    const allShifts = cycle.weeks.flatMap((week) =>
      materializeWeek(week, cycle.patterns),
    );
    for (const employeeId of HISTORICAL_EMPLOYEE_NAMES) {
      const shifts = allShifts.filter((shift) => shift.employeeId === employeeId);
      expect(shifts.filter((shift) => shift.kind === "MORNING")).toHaveLength(29);
      expect(shifts.filter((shift) => shift.kind === "AFTERNOON")).toHaveLength(21);
      expect(shifts.filter((shift) => shift.kind === "FREE")).toHaveLength(20);
      expect(shifts.filter((shift) => shift.startTime === "05:30")).toHaveLength(6);
      expect(shifts.filter((shift) => shift.startTime === "07:00")).toHaveLength(7);
      expect(shifts.filter((shift) => shift.startTime === "08:00")).toHaveLength(16);
    }
  });

  it("mantiene la cadena sábado 07:00, domingo 07:00 y lunes 05:30", () => {
    for (let index = 0; index < cycle.weeks.length; index += 1) {
      const week = cycle.weeks[index];
      const nextWeek = cycle.weeks[(index + 1) % cycle.weeks.length];
      expect(week).toBeDefined();
      expect(nextWeek).toBeDefined();
      const shifts = materializeWeek(week!, BASE_PATTERNS);
      const nextShifts = materializeWeek(nextWeek!, BASE_PATTERNS);
      const saturday = shifts.find((shift) => shift.day === "SATURDAY" && shift.startTime === "07:00");
      const sunday = shifts.find((shift) => shift.day === "SUNDAY" && shift.startTime === "07:00");
      const monday = nextShifts.find((shift) => shift.day === "MONDAY" && shift.startTime === "05:30");
      expect(saturday?.employeeId).toBe(sunday?.employeeId);
      expect(sunday?.employeeId).toBe(monday?.employeeId);
    }
  });

  it("produce un ciclo sin errores de validación", () => {
    expect(validateCycle(cycle)).toEqual([]);
  });
});

describe("errores explicables", () => {
  it("rechaza empleados desconocidos con error tipado", () => {
    expect(() =>
      rotateEmployee("DESCONOCIDO", 1, HISTORICAL_EMPLOYEE_NAMES),
    ).toThrow(UnknownEmployeeError);
  });

  it("rechaza un orden duplicado o incompleto", () => {
    const duplicated = [...HISTORICAL_EMPLOYEE_NAMES.slice(0, 9), "ROE"];
    expect(() =>
      generateCycle({
        week1Assignment: WEEK_1_ASSIGNMENT,
        patterns: BASE_PATTERNS,
        rotationOrder: duplicated,
      }),
    ).toThrow(InvalidRotationOrderError);
    expect(() =>
      generateCycle({
        week1Assignment: WEEK_1_ASSIGNMENT,
        patterns: BASE_PATTERNS,
        rotationOrder: HISTORICAL_EMPLOYEE_NAMES.slice(0, 9),
      }),
    ).toThrow(InvalidRotationOrderError);
  });
});
