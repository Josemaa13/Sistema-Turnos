import type { Employee, WeekAssignment } from "./types";

export const HISTORICAL_EMPLOYEE_NAMES = [
  "ROE",
  "ISA",
  "MARIA",
  "RO",
  "LUCIA",
  "SOSA",
  "ROCIO",
  "ANA",
  "NATALIA",
  "JUANA",
] as const;

export const HISTORICAL_EMPLOYEES: readonly Employee[] =
  HISTORICAL_EMPLOYEE_NAMES.map((displayName, rotationPosition) => ({
    id: displayName,
    displayName,
    active: true,
    rotationPosition,
    roleIds: [],
  }));

export const WEEK_1_ASSIGNMENT: WeekAssignment = {
  P01: "ROE",
  P02: "ISA",
  P03: "MARIA",
  P04: "RO",
  P05: "LUCIA",
  P06: "SOSA",
  P07: "ROCIO",
  P08: "ANA",
  P09: "NATALIA",
  P10: "JUANA",
};
