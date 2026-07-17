import { DAYS, type Day, type ScheduledShift } from "@/domain/scheduling";

const DAY_LABELS: Readonly<Record<Day, string>> = {
  MONDAY: "Lunes",
  TUESDAY: "Martes",
  WEDNESDAY: "Miércoles",
  THURSDAY: "Jueves",
  FRIDAY: "Viernes",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

type DisplayShift = ScheduledShift & { readonly exceptionId?: string };

interface ScheduleGridProps {
  readonly ariaLabel?: string;
  readonly shifts: readonly DisplayShift[];
  readonly dateLabels: Readonly<Record<Day, string>>;
  readonly selectedEmployee: string | null;
  readonly issueDays: ReadonlySet<Day>;
  readonly canEditException: boolean;
  readonly onSelectEmployee: (employeeId: string) => void;
  readonly onSelectShift: (shift: DisplayShift) => void;
}

function compareShifts(left: DisplayShift, right: DisplayShift): number {
  return (left.startTime ?? "99:99").localeCompare(right.startTime ?? "99:99") ||
    left.employeeId.localeCompare(right.employeeId);
}

function ShiftCard({
  shift,
  selected,
  editable,
  onSelectEmployee,
  onSelectShift,
}: {
  readonly shift: DisplayShift;
  readonly selected: boolean;
  readonly editable: boolean;
  readonly onSelectEmployee: (employeeId: string) => void;
  readonly onSelectShift: (shift: DisplayShift) => void;
}) {
  return (
    <button
      className={`shift-card shift-${shift.kind.toLowerCase()}${selected ? " is-selected" : ""}${shift.exceptionId ? " has-exception" : ""}`}
      type="button"
      onClick={() => {
        onSelectEmployee(shift.employeeId);
        if (editable) onSelectShift(shift);
      }}
      aria-label={`${shift.employeeId}, ${shift.kind === "FREE" ? "libre" : shift.kind === "AFTERNOON" ? "turno de tarde" : `turno de mañana a las ${shift.startTime}`}`}
    >
      <span>{shift.employeeId}</span>
      {shift.startTime && <time>{shift.startTime}</time>}
      {shift.exceptionId && <small>Excepción</small>}
    </button>
  );
}

export function ScheduleGrid({
  ariaLabel = "Cuadrante semanal",
  shifts,
  dateLabels,
  selectedEmployee,
  issueDays,
  canEditException,
  onSelectEmployee,
  onSelectShift,
}: ScheduleGridProps) {
  return (
    <div className="schedule-grid" aria-label={ariaLabel}>
      {DAYS.map((day) => {
        const dayShifts = shifts.filter((shift) => shift.day === day);
        const groups = [
          { kind: "FREE" as const, label: "Libres" },
          { kind: "MORNING" as const, label: "Mañana" },
          { kind: "AFTERNOON" as const, label: "Tarde" },
        ];
        return (
          <section
            className={`day-column${issueDays.has(day) ? " has-issue" : ""}`}
            key={day}
          >
            <header>
              <span>{DAY_LABELS[day]}</span>
              <time>{dateLabels[day]}</time>
            </header>
            {groups.map((group) => (
              <div className={`shift-group group-${group.kind.toLowerCase()}`} key={group.kind}>
                <h3>{group.label}</h3>
                {dayShifts
                  .filter((shift) => shift.kind === group.kind)
                  .sort(compareShifts)
                  .map((shift) => (
                    <ShiftCard
                      key={`${shift.patternId}-${shift.employeeId}`}
                      shift={shift}
                      selected={selectedEmployee === shift.employeeId}
                      editable={canEditException}
                      onSelectEmployee={onSelectEmployee}
                      onSelectShift={onSelectShift}
                    />
                  ))}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
