import { BASE_PATTERNS, type EmployeeId, type PatternId, type WeekAssignment } from "@/domain/scheduling";

interface AssignmentEditorProps {
  readonly assignment: WeekAssignment;
  readonly employees: readonly EmployeeId[];
  readonly disabled: boolean;
  readonly onAssign: (patternId: PatternId, employeeId: EmployeeId) => void;
}

export function AssignmentEditor({
  assignment,
  employees,
  disabled,
  onAssign,
}: AssignmentEditorProps) {
  return (
    <div className="assignment-list">
      {BASE_PATTERNS.map((pattern) => {
        const freeDays = pattern.days
          .filter((day) => day.kind === "FREE")
          .map((day) => day.day.slice(0, 2))
          .join(" · ");
        return (
          <label key={pattern.id}>
            <span>
              <strong>{pattern.id}</strong>
              <small>Libra {freeDays}</small>
            </span>
            <select
              value={assignment[pattern.id]}
              disabled={disabled}
              onChange={(event) => onAssign(pattern.id, event.target.value)}
              aria-label={`Empleado para ${pattern.id}`}
            >
              {employees.map((employeeId) => (
                <option key={employeeId} value={employeeId}>
                  {employeeId}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
