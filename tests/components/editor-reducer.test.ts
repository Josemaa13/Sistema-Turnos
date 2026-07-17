import { describe, expect, it } from "vitest";
import { CYCLE_WEEK_NUMBERS, WEEK_1_ASSIGNMENT } from "@/domain/scheduling";
import {
  assignmentHistoryReducer,
  createAssignmentHistory,
} from "@/components/schedule-workspace/editor-reducer";

describe("historial del editor", () => {
  it("intercambia patrones y permite deshacer y rehacer", () => {
    const initial = createAssignmentHistory(WEEK_1_ASSIGNMENT);
    const changed = assignmentHistoryReducer(initial, {
      type: "ASSIGN",
      patternId: "P01",
      employeeId: "ISA",
    });
    expect(changed.present.week1Assignment.P01).toBe("ISA");
    expect(changed.present.week1Assignment.P02).toBe("ROE");
    expect(new Set(Object.values(changed.present.week1Assignment))).toHaveLength(10);

    const undone = assignmentHistoryReducer(changed, { type: "UNDO" });
    expect(undone.present.week1Assignment).toEqual(WEEK_1_ASSIGNMENT);
    const redone = assignmentHistoryReducer(undone, { type: "REDO" });
    expect(redone.present).toEqual(changed.present);
  });

  it("limpia solo la semana indicada y permite deshacer y rehacer", () => {
    const initial = createAssignmentHistory(WEEK_1_ASSIGNMENT);
    const cleared = assignmentHistoryReducer(initial, {
      type: "CLEAR_WEEK",
      weekNumber: 4,
    });

    expect(cleared.present.clearedWeekNumbers).toEqual([4]);
    expect(cleared.present.week1Assignment).toEqual(WEEK_1_ASSIGNMENT);
    expect(assignmentHistoryReducer(cleared, { type: "UNDO" }).present.clearedWeekNumbers).toEqual([]);

    const undone = assignmentHistoryReducer(cleared, { type: "UNDO" });
    const redone = assignmentHistoryReducer(undone, { type: "REDO" });
    expect(redone.present.clearedWeekNumbers).toEqual([4]);
  });

  it("limpia las diez semanas y regenerar las restaura de forma reversible", () => {
    const initial = createAssignmentHistory(WEEK_1_ASSIGNMENT, [3]);
    const cleared = assignmentHistoryReducer(initial, { type: "CLEAR_ALL" });
    expect(cleared.present.clearedWeekNumbers).toEqual(CYCLE_WEEK_NUMBERS);

    const clearedUndone = assignmentHistoryReducer(cleared, { type: "UNDO" });
    expect(clearedUndone.present.clearedWeekNumbers).toEqual([3]);
    expect(
      assignmentHistoryReducer(clearedUndone, { type: "REDO" }).present
        .clearedWeekNumbers,
    ).toEqual(CYCLE_WEEK_NUMBERS);

    const regenerated = assignmentHistoryReducer(cleared, { type: "REGENERATE" });
    expect(regenerated.present.clearedWeekNumbers).toEqual([]);
    expect(
      assignmentHistoryReducer(regenerated, { type: "UNDO" }).present
        .clearedWeekNumbers,
    ).toEqual(CYCLE_WEEK_NUMBERS);
  });
});
