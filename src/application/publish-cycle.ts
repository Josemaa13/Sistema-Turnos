import { validateCycle } from "@/domain/scheduling";
import { generateStoredCycle } from "./cycle-helpers";
import { CycleNotFoundError, PublicationBlockedError } from "./errors";
import type { PublishedScheduleSnapshot, ScheduleCycle } from "./models";
import {
  DEFAULT_SERVICES,
  type ApplicationServices,
  type ScheduleRepository,
} from "./ports";

export interface PublishCycleResult {
  readonly cycle: ScheduleCycle;
  readonly snapshot: PublishedScheduleSnapshot;
}

export async function publishCycle(
  cycleId: string,
  repository: ScheduleRepository,
  services: ApplicationServices = DEFAULT_SERVICES,
): Promise<PublishCycleResult> {
  const stored = await repository.findCycle(cycleId);
  if (!stored) throw new CycleNotFoundError(cycleId);
  const generatedCycle = generateStoredCycle(stored);
  const blocking = validateCycle(generatedCycle).filter(
    (issue) => issue.severity === "ERROR",
  );
  if (blocking.length > 0) {
    throw new PublicationBlockedError(blocking.map((issue) => issue.message));
  }

  const previous = await repository.listSnapshots(cycleId);
  const publishedAt = services.now();
  const snapshot: PublishedScheduleSnapshot = {
    id: services.createId(),
    cycleId,
    version: Math.max(0, ...previous.map((item) => item.version)) + 1,
    payload: { generatedCycle, exceptions: stored.exceptions },
    publishedAt,
  };
  const cycle: ScheduleCycle = {
    ...stored,
    status: "PUBLISHED",
    updatedAt: publishedAt,
  };
  await repository.saveSnapshot(snapshot);
  await repository.saveCycle(cycle);
  return { cycle, snapshot };
}
