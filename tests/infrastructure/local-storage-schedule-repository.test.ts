import { beforeEach, describe, expect, it } from "vitest";
import {
  createCycle,
  publishCycle,
  saveCycleDraft,
  type ApplicationServices,
} from "@/application";
import {
  HISTORICAL_EMPLOYEE_NAMES,
  WEEK_1_ASSIGNMENT,
} from "@/domain/scheduling";
import { LocalStorageScheduleRepository } from "@/infrastructure/repositories/local-storage-schedule-repository";

const STORAGE_KEY = "sistema-turnos:test-cleared-weeks";
const services: ApplicationServices = {
  now: () => "2026-07-17T10:00:00.000Z",
  createId: () => "cycle-test-id",
};

describe("repositorio local de ciclos", () => {
  beforeEach(() => localStorage.clear());

  it("guarda, recupera y publica las semanas limpiadas normalizadas", async () => {
    const repository = new LocalStorageScheduleRepository(STORAGE_KEY);
    const draft = await createCycle(
      {
        startsOn: "2026-07-20",
        week1Assignment: WEEK_1_ASSIGNMENT,
        rotationOrder: HISTORICAL_EMPLOYEE_NAMES,
      },
      repository,
      services,
    );
    const saved = await saveCycleDraft(
      {
        cycleId: draft.id,
        startsOn: draft.startsOn,
        week1Assignment: draft.week1Assignment,
        rotationOrder: draft.rotationOrder,
        clearedWeekNumbers: [7, 2, 7],
      },
      repository,
      services,
    );

    expect(saved.clearedWeekNumbers).toEqual([2, 7]);
    expect((await repository.findCycle(draft.id))?.clearedWeekNumbers).toEqual([2, 7]);

    await publishCycle(draft.id, repository, services);
    const snapshots = await repository.listSnapshots(draft.id);
    expect(snapshots[0]?.payload.clearedWeekNumbers).toEqual([2, 7]);
  });

  it("carga ciclos y snapshots antiguos sin el nuevo campo", async () => {
    const repository = new LocalStorageScheduleRepository(STORAGE_KEY);
    const draft = await createCycle(
      {
        startsOn: "2026-07-20",
        week1Assignment: WEEK_1_ASSIGNMENT,
        rotationOrder: HISTORICAL_EMPLOYEE_NAMES,
      },
      repository,
      services,
    );
    await publishCycle(draft.id, repository, services);

    const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as {
      cycles: Array<Record<string, unknown>>;
      snapshots: Array<{ payload: Record<string, unknown> }>;
    };
    delete legacy.cycles[0]?.clearedWeekNumbers;
    delete legacy.snapshots[0]?.payload.clearedWeekNumbers;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

    expect((await repository.findCycle(draft.id))?.clearedWeekNumbers).toEqual([]);
    expect((await repository.listSnapshots(draft.id))[0]?.payload.clearedWeekNumbers)
      .toEqual([]);
  });
});
