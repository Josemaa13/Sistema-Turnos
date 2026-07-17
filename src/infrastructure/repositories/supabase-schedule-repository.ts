import type {
  PublishedScheduleSnapshot,
  ScheduleCycle,
} from "@/application/models";
import type { ScheduleRepository } from "@/application/ports";
import {
  normalizeClearedWeekNumbers,
  type PatternDay,
  type ScheduleException,
  type WeekAssignment,
} from "@/domain/scheduling";
import type { SupabaseClient } from "@supabase/supabase-js";

interface CycleAssignmentRow {
  readonly pattern_id: string;
  readonly employee_id: string;
}

interface ExceptionRow {
  readonly id: string;
  readonly cycle_id: string;
  readonly date: string;
  readonly employee_id: string;
  readonly original: PatternDay;
  readonly replacement: PatternDay;
  readonly reason: string;
  readonly created_by: string;
  readonly created_at: string;
}

interface CycleRow {
  readonly id: string;
  readonly template_id: string;
  readonly starts_on: string;
  readonly status: ScheduleCycle["status"];
  readonly rotation_order: readonly string[];
  readonly pattern_ids: readonly ScheduleCycle["patternIds"][number][];
  readonly cleared_week_numbers?: readonly number[];
  readonly created_at: string;
  readonly updated_at: string;
  readonly cycle_assignments?: readonly CycleAssignmentRow[];
  readonly schedule_exceptions?: readonly ExceptionRow[];
}

function exceptionFromRow(row: ExceptionRow): ScheduleException {
  return {
    id: row.id,
    cycleId: row.cycle_id,
    date: row.date,
    employeeId: row.employee_id,
    original: row.original,
    replacement: row.replacement,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function cycleFromRow(row: CycleRow): ScheduleCycle {
  return {
    id: row.id,
    templateId: row.template_id,
    startsOn: row.starts_on,
    status: row.status,
    clearedWeekNumbers: normalizeClearedWeekNumbers(row.cleared_week_numbers),
    rotationOrder: row.rotation_order,
    patternIds: row.pattern_ids,
    week1Assignment: Object.fromEntries(
      (row.cycle_assignments ?? []).map((item) => [
        item.pattern_id,
        item.employee_id,
      ]),
    ) as WeekAssignment,
    exceptions: (row.schedule_exceptions ?? []).map(exceptionFromRow),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CYCLE_SELECT =
  "*, cycle_assignments(pattern_id, employee_id), schedule_exceptions(*)";

export class SupabaseScheduleRepository implements ScheduleRepository {
  constructor(private readonly client: SupabaseClient) {}

  async saveCycle(cycle: ScheduleCycle): Promise<void> {
    const { error: cycleError } = await this.client.from("schedule_cycles").upsert({
      id: cycle.id,
      template_id: cycle.templateId,
      starts_on: cycle.startsOn,
      status: cycle.status,
      rotation_order: cycle.rotationOrder,
      pattern_ids: cycle.patternIds,
      cleared_week_numbers: cycle.clearedWeekNumbers,
      created_at: cycle.createdAt,
      updated_at: cycle.updatedAt,
    });
    if (cycleError) throw cycleError;

    const assignments = Object.entries(cycle.week1Assignment).map(
      ([patternId, employeeId]) => ({
        cycle_id: cycle.id,
        pattern_id: patternId,
        employee_id: employeeId,
      }),
    );
    const { error: assignmentError } = await this.client
      .from("cycle_assignments")
      .upsert(assignments, { onConflict: "cycle_id,pattern_id" });
    if (assignmentError) throw assignmentError;

    if (cycle.exceptions.length > 0) {
      const { error: exceptionError } = await this.client
        .from("schedule_exceptions")
        .upsert(
          cycle.exceptions.map((item) => ({
            id: item.id,
            cycle_id: item.cycleId,
            date: item.date,
            employee_id: item.employeeId,
            original: item.original,
            replacement: item.replacement,
            reason: item.reason,
            created_by: item.createdBy,
            created_at: item.createdAt,
          })),
        );
      if (exceptionError) throw exceptionError;
    }
  }

  async findCycle(cycleId: string): Promise<ScheduleCycle | null> {
    const { data, error } = await this.client
      .from("schedule_cycles")
      .select(CYCLE_SELECT)
      .eq("id", cycleId)
      .maybeSingle();
    if (error) throw error;
    return data ? cycleFromRow(data as CycleRow) : null;
  }

  async listCycles(): Promise<readonly ScheduleCycle[]> {
    const { data, error } = await this.client
      .from("schedule_cycles")
      .select(CYCLE_SELECT)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => cycleFromRow(row as CycleRow));
  }

  async saveSnapshot(snapshot: PublishedScheduleSnapshot): Promise<void> {
    const { error } = await this.client
      .from("published_schedule_snapshots")
      .insert({
        id: snapshot.id,
        cycle_id: snapshot.cycleId,
        version: snapshot.version,
        payload: snapshot.payload,
        published_at: snapshot.publishedAt,
      });
    if (error) throw error;
  }

  async listSnapshots(
    cycleId: string,
  ): Promise<readonly PublishedScheduleSnapshot[]> {
    const { data, error } = await this.client
      .from("published_schedule_snapshots")
      .select("*")
      .eq("cycle_id", cycleId)
      .order("version", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: String(row.id),
      cycleId: String(row.cycle_id),
      version: Number(row.version),
      payload: {
        ...(row.payload as PublishedScheduleSnapshot["payload"]),
        clearedWeekNumbers: normalizeClearedWeekNumbers(
          (row.payload as Partial<PublishedScheduleSnapshot["payload"]>)
            .clearedWeekNumbers,
        ),
      },
      publishedAt: String(row.published_at),
    }));
  }
}
