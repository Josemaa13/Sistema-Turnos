import { describe, expect, it } from "vitest";
import { WEEK_1_ASSIGNMENT } from "@/domain/scheduling";
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
    expect(changed.present.P01).toBe("ISA");
    expect(changed.present.P02).toBe("ROE");
    expect(new Set(Object.values(changed.present))).toHaveLength(10);

    const undone = assignmentHistoryReducer(changed, { type: "UNDO" });
    expect(undone.present).toEqual(WEEK_1_ASSIGNMENT);
    const redone = assignmentHistoryReducer(undone, { type: "REDO" });
    expect(redone.present).toEqual(changed.present);
  });
});
