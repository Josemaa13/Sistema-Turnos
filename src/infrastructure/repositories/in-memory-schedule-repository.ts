import type {
  PublishedScheduleSnapshot,
  ScheduleCycle,
} from "@/application/models";
import type { ScheduleRepository } from "@/application/ports";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryScheduleRepository implements ScheduleRepository {
  private readonly cycles = new Map<string, ScheduleCycle>();
  private readonly snapshots = new Map<string, PublishedScheduleSnapshot[]>();

  async saveCycle(cycle: ScheduleCycle): Promise<void> {
    this.cycles.set(cycle.id, clone(cycle));
  }

  async findCycle(cycleId: string): Promise<ScheduleCycle | null> {
    const cycle = this.cycles.get(cycleId);
    return cycle ? clone(cycle) : null;
  }

  async listCycles(): Promise<readonly ScheduleCycle[]> {
    return [...this.cycles.values()].map(clone);
  }

  async saveSnapshot(snapshot: PublishedScheduleSnapshot): Promise<void> {
    const current = this.snapshots.get(snapshot.cycleId) ?? [];
    if (current.some((item) => item.version === snapshot.version)) {
      throw new Error(
        `Ya existe la versión ${snapshot.version} del ciclo ${snapshot.cycleId}.`,
      );
    }
    this.snapshots.set(snapshot.cycleId, [...current, clone(snapshot)]);
  }

  async listSnapshots(
    cycleId: string,
  ): Promise<readonly PublishedScheduleSnapshot[]> {
    return (this.snapshots.get(cycleId) ?? []).map(clone);
  }
}
