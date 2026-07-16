import { useMemo, useState } from "react";
import { findPatternsForFreeDays } from "@/application";
import { DAYS, type Day, type EmployeeId, type PatternId } from "@/domain/scheduling";

const SHORT_DAY: Readonly<Record<Day, string>> = {
  MONDAY: "L",
  TUESDAY: "M",
  WEDNESDAY: "X",
  THURSDAY: "J",
  FRIDAY: "V",
  SATURDAY: "S",
  SUNDAY: "D",
};

function shiftToken(kind: string, startTime: string | null): string {
  if (kind === "FREE") return "Libre";
  if (kind === "AFTERNOON") return "Tarde";
  return startTime ?? "Mañana";
}

export function GuidedPanel({
  employees,
  onChoose,
}: {
  readonly employees: readonly EmployeeId[];
  readonly onChoose: (employeeId: EmployeeId, patternId: PatternId) => void;
}) {
  const [employeeId, setEmployeeId] = useState<EmployeeId>(employees[3] ?? employees[0] ?? "");
  const [freeDays, setFreeDays] = useState<Day[]>(["MONDAY", "TUESDAY"]);
  const result = useMemo(() => findPatternsForFreeDays(freeDays), [freeDays]);
  const toggleDay = (day: Day) => {
    setFreeDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : current.length < 2
          ? [...current, day]
          : [current[1]!, day],
    );
  };

  return (
    <div className="guided-panel">
      <label className="field-label">
        Empleado
        <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
          {employees.map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <fieldset>
        <legend>Días libres</legend>
        <div className="day-pills">
          {DAYS.map((day) => (
            <button
              type="button"
              key={day}
              className={freeDays.includes(day) ? "is-active" : ""}
              onClick={() => toggleDay(day)}
              aria-pressed={freeDays.includes(day)}
              title={day}
            >
              {SHORT_DAY[day]}
            </button>
          ))}
        </div>
      </fieldset>

      {result.kind === "NONE" && <p className="inline-message error">{result.reason}</p>}
      {result.kind === "UNIQUE" && (
        <div className="match-card">
          <span>Coincidencia única</span>
          <strong>{result.patternId}</strong>
          <button type="button" onClick={() => onChoose(employeeId, result.patternId)}>
            Aplicar patrón
          </button>
        </div>
      )}
      {result.kind === "AMBIGUOUS" && (
        <div className="match-options">
          <p>Hay {result.candidates.length} variantes. Elige una:</p>
          {result.candidates.map((candidate) => (
            <button
              type="button"
              key={candidate.patternId}
              onClick={() => onChoose(employeeId, candidate.patternId)}
            >
              <span>
                <strong>{candidate.patternId}</strong>
                {candidate.tags[0] !== "STANDARD" && <small>Especial</small>}
              </span>
              <span className="pattern-sequence">
                {candidate.sequence.map((day) => (
                  <i key={day.day}>{shiftToken(day.kind, day.startTime)}</i>
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
