import type {
  PublishedScheduleSnapshot,
  ScheduleCycle,
} from "@/application/models";
import type { ScheduleRepository } from "@/application/ports";

interface StoredScheduleData {
  readonly cycles: readonly ScheduleCycle[];
  readonly snapshots: readonly PublishedScheduleSnapshot[];
}

const EMPTY_DATA: StoredScheduleData = { cycles: [], snapshots: [] };

export class LocalStorageScheduleRepository implements ScheduleRepository {
  constructor(private readonly storageKey = "sistema-turnos:v1") {}

  private read(): StoredScheduleData {
    const raw = globalThis.localStorage?.getItem(this.storageKey);
    if (!raw) return EMPTY_DATA;
    try {
      return JSON.parse(raw) as StoredScheduleData;
    } catch {
      return EMPTY_DATA;
    }
  }

  private write(data: StoredScheduleData): void {
    globalThis.localStorage?.setItem(this.storageKey, JSON.stringify(data));
  }

  async saveCycle(cycle: ScheduleCycle): Promise<void> {
    const data = this.read();
    this.write({
      ...data,
      cycles: [...data.cycles.filter((item) => item.id !== cycle.id), cycle],
    });
  }

  async findCycle(cycleId: string): Promise<ScheduleCycle | null> {
    return this.read().cycles.find((item) => item.id === cycleId) ?? null;
  }

  async listCycles(): Promise<readonly ScheduleCycle[]> {
    return this.read().cycles;
  }

  async saveSnapshot(snapshot: PublishedScheduleSnapshot): Promise<void> {
    const data = this.read();
    if (
      data.snapshots.some(
        (item) =>
          item.cycleId === snapshot.cycleId && item.version === snapshot.version,
      )
    ) {
      throw new Error(`La versión ${snapshot.version} ya existe.`);
    }
    this.write({ ...data, snapshots: [...data.snapshots, snapshot] });
  }

  async listSnapshots(
    cycleId: string,
  ): Promise<readonly PublishedScheduleSnapshot[]> {
    return this.read().snapshots.filter((item) => item.cycleId === cycleId);
  }
}
