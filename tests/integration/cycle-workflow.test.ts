import { beforeEach, describe, expect, it } from "vitest";
import {
  applyException,
  createCycle,
  generateStoredCycle,
  publishCycle,
  validateStoredCycle,
  type ApplicationServices,
} from "@/application";
import {
  BASE_PATTERNS,
  HISTORICAL_EMPLOYEE_NAMES,
  WEEK_1_ASSIGNMENT,
} from "@/domain/scheduling";
import { InMemoryScheduleRepository } from "@/infrastructure/repositories/in-memory-schedule-repository";

function deterministicServices(): ApplicationServices {
  let sequence = 0;
  return {
    now: () => "2026-07-16T12:00:00.000Z",
    createId: () => `test-id-${++sequence}`,
  };
}

describe("flujo de ciclo", () => {
  let repository: InMemoryScheduleRepository;
  let services: ApplicationServices;

  beforeEach(() => {
    repository = new InMemoryScheduleRepository();
    services = deterministicServices();
  });

  it("crea, genera, valida, guarda y recupera el mismo cuadrante", async () => {
    const draft = await createCycle(
      {
        startsOn: "2026-07-20",
        week1Assignment: WEEK_1_ASSIGNMENT,
        rotationOrder: HISTORICAL_EMPLOYEE_NAMES,
      },
      repository,
      services,
    );
    expect(draft.status).toBe("DRAFT");

    const validation = await validateStoredCycle(draft.id, repository, services);
    expect(validation.issues).toEqual([]);
    expect(validation.cycle.status).toBe("VALIDATED");

    const reloaded = await repository.findCycle(draft.id);
    expect(reloaded).not.toBeNull();
    expect(generateStoredCycle(reloaded!)).toEqual(generateStoredCycle(validation.cycle));
  });

  it("publica snapshots versionados e inmutables", async () => {
    const draft = await createCycle(
      {
        startsOn: "2026-07-20",
        week1Assignment: WEEK_1_ASSIGNMENT,
        rotationOrder: HISTORICAL_EMPLOYEE_NAMES,
      },
      repository,
      services,
    );
    const first = await publishCycle(draft.id, repository, services);
    expect(first.snapshot.version).toBe(1);
    expect(first.snapshot.payload.exceptions).toEqual([]);

    await applyException(
      {
        cycleId: draft.id,
        date: "2026-07-20",
        employeeId: "ROE",
        replacement: {
          day: "MONDAY",
          kind: "MORNING",
          startTime: "08:00",
        },
        reason: "Cobertura puntual autorizada",
        createdBy: "admin",
      },
      repository,
      services,
    );
    const second = await publishCycle(draft.id, repository, services);
    expect(second.snapshot.version).toBe(2);
    expect(second.snapshot.payload.exceptions).toHaveLength(1);

    const snapshots = await repository.listSnapshots(draft.id);
    expect(snapshots[0]?.payload.exceptions).toEqual([]);
    expect(snapshots[1]?.payload.exceptions).toHaveLength(1);
  });

  it("registra una excepción sin mutar BASE_PATTERNS", async () => {
    const canonicalBefore = structuredClone(BASE_PATTERNS);
    const draft = await createCycle(
      {
        startsOn: "2026-07-20",
        week1Assignment: WEEK_1_ASSIGNMENT,
        rotationOrder: HISTORICAL_EMPLOYEE_NAMES,
      },
      repository,
      services,
    );
    const result = await applyException(
      {
        cycleId: draft.id,
        date: "2026-07-21",
        employeeId: "ROE",
        replacement: {
          day: "TUESDAY",
          kind: "AFTERNOON",
          startTime: null,
        },
        reason: "Cambio manual aprobado",
        createdBy: "admin",
      },
      repository,
      services,
    );
    expect(result.warning).toContain("Excepción manual registrada");
    expect(result.cycle.exceptions).toHaveLength(1);
    expect(BASE_PATTERNS).toEqual(canonicalBefore);
  });
});
