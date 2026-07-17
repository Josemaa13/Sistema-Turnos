import { assignEmployeeToPattern } from "@/application";
import {
  CYCLE_WEEK_NUMBERS,
  normalizeClearedWeekNumbers,
  type CycleWeekNumber,
  type EmployeeId,
  type PatternId,
  type WeekAssignment,
} from "@/domain/scheduling";

export interface EditorSnapshot {
  readonly week1Assignment: WeekAssignment;
  readonly clearedWeekNumbers: readonly CycleWeekNumber[];
}

export interface AssignmentHistory {
  readonly past: readonly EditorSnapshot[];
  readonly present: EditorSnapshot;
  readonly future: readonly EditorSnapshot[];
}

export type AssignmentAction =
  | {
      readonly type: "ASSIGN";
      readonly patternId: PatternId;
      readonly employeeId: EmployeeId;
    }
  | { readonly type: "CLEAR_WEEK"; readonly weekNumber: CycleWeekNumber }
  | { readonly type: "CLEAR_ALL" }
  | { readonly type: "REGENERATE" }
  | { readonly type: "UNDO" }
  | { readonly type: "REDO" }
  | {
      readonly type: "RESET";
      readonly assignment: WeekAssignment;
      readonly clearedWeekNumbers?: readonly CycleWeekNumber[];
    };

export function createAssignmentHistory(
  assignment: WeekAssignment,
  clearedWeekNumbers: readonly CycleWeekNumber[] = [],
): AssignmentHistory {
  return {
    past: [],
    present: {
      week1Assignment: assignment,
      clearedWeekNumbers: normalizeClearedWeekNumbers(clearedWeekNumbers),
    },
    future: [],
  };
}

function pushSnapshot(
  state: AssignmentHistory,
  present: EditorSnapshot,
): AssignmentHistory {
  return { past: [...state.past, state.present], present, future: [] };
}

export function assignmentHistoryReducer(
  state: AssignmentHistory,
  action: AssignmentAction,
): AssignmentHistory {
  if (action.type === "RESET") {
    return createAssignmentHistory(action.assignment, action.clearedWeekNumbers);
  }
  if (action.type === "ASSIGN") {
    const week1Assignment = assignEmployeeToPattern(
      state.present.week1Assignment,
      action.patternId,
      action.employeeId,
    );
    if (
      week1Assignment[action.patternId] ===
      state.present.week1Assignment[action.patternId]
    ) {
      return state;
    }
    return pushSnapshot(state, { ...state.present, week1Assignment });
  }
  if (action.type === "CLEAR_WEEK") {
    if (state.present.clearedWeekNumbers.includes(action.weekNumber)) return state;
    return pushSnapshot(state, {
      ...state.present,
      clearedWeekNumbers: normalizeClearedWeekNumbers([
        ...state.present.clearedWeekNumbers,
        action.weekNumber,
      ]),
    });
  }
  if (action.type === "CLEAR_ALL") {
    if (state.present.clearedWeekNumbers.length === CYCLE_WEEK_NUMBERS.length) {
      return state;
    }
    return pushSnapshot(state, {
      ...state.present,
      clearedWeekNumbers: CYCLE_WEEK_NUMBERS,
    });
  }
  if (action.type === "REGENERATE") {
    if (state.present.clearedWeekNumbers.length === 0) return state;
    return pushSnapshot(state, { ...state.present, clearedWeekNumbers: [] });
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
