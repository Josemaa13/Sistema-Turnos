import { assignEmployeeToPattern } from "@/application";
import type { EmployeeId, PatternId, WeekAssignment } from "@/domain/scheduling";

export interface AssignmentHistory {
  readonly past: readonly WeekAssignment[];
  readonly present: WeekAssignment;
  readonly future: readonly WeekAssignment[];
}

export type AssignmentAction =
  | {
      readonly type: "ASSIGN";
      readonly patternId: PatternId;
      readonly employeeId: EmployeeId;
    }
  | { readonly type: "UNDO" }
  | { readonly type: "REDO" }
  | { readonly type: "RESET"; readonly assignment: WeekAssignment };

export function createAssignmentHistory(
  assignment: WeekAssignment,
): AssignmentHistory {
  return { past: [], present: assignment, future: [] };
}

export function assignmentHistoryReducer(
  state: AssignmentHistory,
  action: AssignmentAction,
): AssignmentHistory {
  if (action.type === "RESET") return createAssignmentHistory(action.assignment);
  if (action.type === "ASSIGN") {
    const next = assignEmployeeToPattern(
      state.present,
      action.patternId,
      action.employeeId,
    );
    if (next[action.patternId] === state.present[action.patternId]) return state;
    return { past: [...state.past, state.present], present: next, future: [] };
  }
  if (action.type === "UNDO") {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future],
    };
  }
  const next = state.future[0];
  if (!next) return state;
  return {
    past: [...state.past, state.present],
    present: next,
    future: state.future.slice(1),
  };
}
