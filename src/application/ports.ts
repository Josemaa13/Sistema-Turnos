import type { PublishedScheduleSnapshot, ScheduleCycle } from "./models";

export interface ScheduleRepository {
  saveCycle(cycle: ScheduleCycle): Promise<void>;
  findCycle(cycleId: string): Promise<ScheduleCycle | null>;
  listCycles(): Promise<readonly ScheduleCycle[]>;
  saveSnapshot(snapshot: PublishedScheduleSnapshot): Promise<void>;
  listSnapshots(cycleId: string): Promise<readonly PublishedScheduleSnapshot[]>;
}

export interface ApplicationServices {
  readonly now: () => string;
  readonly createId: () => string;
}

export const DEFAULT_SERVICES: ApplicationServices = {
  now: () => new Date().toISOString(),
  createId: () => crypto.randomUUID(),
};
