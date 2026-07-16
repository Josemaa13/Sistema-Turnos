import type {
  EmployeeId,
  GeneratedCycle,
  PatternId,
  ScheduleException,
  WeekAssignment,
} from "@/domain/scheduling";

export type CycleStatus = "DRAFT" | "VALIDATED" | "PUBLISHED" | "ARCHIVED";

export interface ScheduleCycle {
  readonly id: string;
  readonly templateId: string;
  readonly startsOn: string;
  readonly status: CycleStatus;
  readonly week1Assignment: WeekAssignment;
  readonly rotationOrder: readonly EmployeeId[];
  readonly patternIds: readonly PatternId[];
  readonly exceptions: readonly ScheduleException[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PublishedSchedulePayload {
  readonly generatedCycle: GeneratedCycle;
  readonly exceptions: readonly ScheduleException[];
}

export interface PublishedScheduleSnapshot {
  readonly id: string;
  readonly cycleId: string;
  readonly version: number;
  readonly payload: PublishedSchedulePayload;
  readonly publishedAt: string;
}
