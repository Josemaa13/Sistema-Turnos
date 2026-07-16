export const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export type Day = (typeof DAYS)[number];
export type EmployeeId = string;
export type PatternId = `P${string}`;
export type ShiftKind = "FREE" | "MORNING" | "AFTERNOON";
export type MorningStart = "05:30" | "07:00" | "08:00";
export type PatternTag =
  | "STANDARD"
  | "SPECIAL_TUE_WED"
  | "SPECIAL_THU_FRI";

export type PatternDay =
  | { readonly day: Day; readonly kind: "FREE"; readonly startTime: null }
  | {
      readonly day: Day;
      readonly kind: "AFTERNOON";
      readonly startTime: null;
    }
  | {
      readonly day: Day;
      readonly kind: "MORNING";
      readonly startTime: MorningStart;
    };

export interface ShiftPattern {
  readonly id: PatternId;
  readonly days: readonly PatternDay[];
  readonly tags: readonly PatternTag[];
}

export type WeekAssignment = Readonly<Record<PatternId, EmployeeId>>;

export interface GeneratedWeek {
  readonly weekNumber: number;
  readonly assignments: WeekAssignment;
}

export interface GeneratedCycle {
  readonly patterns: readonly ShiftPattern[];
  readonly rotationOrder: readonly EmployeeId[];
  readonly weeks: readonly GeneratedWeek[];
}

export type ScheduledShift = PatternDay & {
  readonly weekNumber: number;
  readonly patternId: PatternId;
  readonly employeeId: EmployeeId;
};

export interface ValidationIssue {
  readonly code: string;
  readonly severity: "ERROR" | "WARNING";
  readonly message: string;
  readonly weekNumber?: number;
  readonly day?: Day;
  readonly employeeId?: EmployeeId;
  readonly patternId?: PatternId;
}

export interface PatternPreview {
  readonly patternId: PatternId;
  readonly freeDays: readonly Day[];
  readonly sequence: readonly PatternDay[];
  readonly returnShift: PatternDay;
  readonly tags: readonly PatternTag[];
}

export type PatternMatchResult =
  | { readonly kind: "UNIQUE"; readonly patternId: PatternId }
  | {
      readonly kind: "AMBIGUOUS";
      readonly candidates: readonly PatternPreview[];
    }
  | { readonly kind: "NONE"; readonly reason: string };

export interface Employee {
  readonly id: EmployeeId;
  readonly displayName: string;
  readonly active: boolean;
  readonly rotationPosition: number;
  readonly roleIds: readonly string[];
}

export interface ScheduleException {
  readonly id: string;
  readonly cycleId: string;
  readonly date: string;
  readonly employeeId: EmployeeId;
  readonly original: PatternDay;
  readonly replacement: PatternDay;
  readonly reason: string;
  readonly createdBy: string;
  readonly createdAt: string;
}
