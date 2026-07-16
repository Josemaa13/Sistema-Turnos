"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import {
  applyException,
  createCyclePreview,
  materializeEffectiveWeek,
  publishCycle,
  saveCycleDraft,
  validateStoredCycle,
  type ScheduleCycle,
} from "@/application";
import {
  DAYS,
  HISTORICAL_EMPLOYEE_NAMES,
  WEEK_1_ASSIGNMENT,
  materializeWeek,
  type Day,
  type EmployeeId,
  type PatternDay,
  type PatternId,
  type ScheduledShift,
  type ValidationIssue,
} from "@/domain/scheduling";
import { LocalStorageScheduleRepository } from "@/infrastructure/repositories/local-storage-schedule-repository";
import { AssignmentEditor } from "@/components/pattern-picker/assignment-editor";
import { GuidedPanel } from "@/components/pattern-picker/guided-panel";
import { ScheduleGrid } from "@/components/schedule-grid/schedule-grid";
import { ValidationPanel } from "@/components/validation-panel/validation-panel";
import { ExceptionEditor } from "./exception-editor";
import {
  assignmentHistoryReducer,
  createAssignmentHistory,
} from "./editor-reducer";

type EditorMode = "AUTOMATIC" | "GUIDED" | "MANUAL_EXCEPTION";

const MODE_LABELS: Readonly<Record<EditorMode, string>> = {
  AUTOMATIC: "Automático",
  GUIDED: "Guiado",
  MANUAL_EXCEPTION: "Excepción manual",
};

function nextMonday(): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  const daysToMonday = (8 - date.getDay()) % 7 || 7;
  date.setDate(date.getDate() + daysToMonday);
  return date.toISOString().slice(0, 10);
}

function isoDateFor(startsOn: string, weekNumber: number, day: Day): string {
  const date = new Date(`${startsOn}T00:00:00.000Z`);
  date.setUTCDate(
    date.getUTCDate() + (weekNumber - 1) * 7 + DAYS.indexOf(day),
  );
  return date.toISOString().slice(0, 10);
}

function dateLabels(startsOn: string, weekNumber: number): Readonly<Record<Day, string>> {
  return Object.fromEntries(
    DAYS.map((day) => {
      const iso = isoDateFor(startsOn, weekNumber, day);
      const label = new Intl.DateTimeFormat("es-ES", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      })
        .format(new Date(`${iso}T00:00:00.000Z`))
        .replace(".", "");
      return [day, label];
    }),
  ) as Readonly<Record<Day, string>>;
}

export function ScheduleWorkspace() {
  const repository = useMemo(() => new LocalStorageScheduleRepository(), []);
  const [history, dispatch] = useReducer(
    assignmentHistoryReducer,
    WEEK_1_ASSIGNMENT,
    createAssignmentHistory,
  );
  const [cycle, setCycle] = useState<ScheduleCycle | null>(null);
  const [startsOn, setStartsOn] = useState(nextMonday);
  const [weekNumber, setWeekNumber] = useState(1);
  const [mode, setMode] = useState<EditorMode>("AUTOMATIC");
  const [editing, setEditing] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeId | null>(null);
  const [selectedShift, setSelectedShift] = useState<ScheduledShift | null>(null);
  const [issues, setIssues] = useState<readonly ValidationIssue[]>([]);
  const [message, setMessage] = useState("Ciclo canónico preparado para generar.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void repository.listCycles().then((cycles) => {
      const latest = [...cycles].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      )[0];
      if (!latest) return;
      setCycle(latest);
      setStartsOn(latest.startsOn);
      dispatch({ type: "RESET", assignment: latest.week1Assignment });
      setMessage(`Borrador recuperado · ${latest.startsOn}`);
    });
  }, [repository]);

  const generated = useMemo(
    () =>
      createCyclePreview({
        week1Assignment: history.present,
        rotationOrder: HISTORICAL_EMPLOYEE_NAMES,
      }),
    [history.present],
  );
  const week = generated.weeks.find((item) => item.weekNumber === weekNumber);
  const shifts = cycle
    ? materializeEffectiveWeek(cycle, generated, weekNumber)
    : week
      ? materializeWeek(week, generated.patterns)
      : [];
  const labels = dateLabels(startsOn, weekNumber);
  const issueDays = new Set(
    issues
      .filter((issue): issue is ValidationIssue & { day: Day } => Boolean(issue.day))
      .map((issue) => issue.day),
  );

  const persist = async (): Promise<ScheduleCycle> => {
    const saved = await saveCycleDraft(
      {
        ...(cycle ? { cycleId: cycle.id } : {}),
        startsOn,
        week1Assignment: history.present,
        rotationOrder: HISTORICAL_EMPLOYEE_NAMES,
        ...(cycle ? { exceptions: cycle.exceptions } : {}),
      },
      repository,
    );
    setCycle(saved);
    return saved;
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  };

  const handleAssign = (patternId: PatternId, employeeId: EmployeeId) => {
    dispatch({ type: "ASSIGN", patternId, employeeId });
    setEditing(true);
    setIssues([]);
    setMessage(`${employeeId} asignado a ${patternId}; se ha conservado la asignación uno a uno.`);
  };

  const handleValidate = () =>
    run(async () => {
      const saved = await persist();
      const result = await validateStoredCycle(saved.id, repository);
      setCycle(result.cycle);
      setIssues(result.issues);
      setMessage(
        result.issues.some((issue) => issue.severity === "ERROR")
          ? "La validación encontró errores bloqueantes."
          : `Ciclo validado${result.issues.length ? " con advertencias" : " sin errores"}.`,
      );
    });

  const handlePublish = () =>
    run(async () => {
      const saved = await persist();
      const result = await publishCycle(saved.id, repository);
      setCycle(result.cycle);
      setMessage(`Publicada la versión ${result.snapshot.version}. El snapshot es inmutable.`);
    });

  const handleSave = () =>
    run(async () => {
      const saved = await persist();
      setMessage(
        saved.id !== cycle?.id
          ? "Se creó un borrador nuevo para no modificar el ciclo publicado."
          : "Borrador guardado en este navegador.",
      );
    });

  const handleException = (replacement: PatternDay, reason: string) => {
    if (!selectedShift) return;
    void run(async () => {
      const saved = await persist();
      const result = await applyException(
        {
          cycleId: saved.id,
          date: isoDateFor(startsOn, weekNumber, selectedShift.day),
          employeeId: selectedShift.employeeId,
          replacement,
          reason,
          createdBy: "admin-local",
        },
        repository,
      );
      setCycle(result.cycle);
      setSelectedShift(null);
      setIssues((current) => [
        ...current,
        {
          code: "MANUAL_EXCEPTION",
          severity: "WARNING",
          message: result.warning,
          weekNumber,
          day: replacement.day,
          employeeId: selectedShift.employeeId,
        },
      ]);
      setMessage(result.warning);
    });
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true"><span>ST</span></div>
        <div className="brand-copy">
          <span>Operaciones · Restaurante</span>
          <h1>Sistema de turnos</h1>
        </div>
        <div className="header-status">
          <span className={`status-dot status-${(cycle?.status ?? "DRAFT").toLowerCase()}`} />
          <div><small>Estado del ciclo</small><strong>{cycle?.status ?? "BORRADOR NUEVO"}</strong></div>
        </div>
      </header>

      <section className="workspace-toolbar no-print">
        <div className="mode-switcher" aria-label="Modo de edición">
          {(Object.keys(MODE_LABELS) as EditorMode[]).map((item) => (
            <button
              type="button"
              key={item}
              className={mode === item ? "is-active" : ""}
              onClick={() => {
                setMode(item);
                if (item !== "AUTOMATIC") setEditing(true);
              }}
            >
              {MODE_LABELS[item]}
            </button>
          ))}
        </div>
        <div className="toolbar-actions">
          <button className="button ghost" type="button" onClick={() => setEditing((value) => !value)}>
            {editing ? "Cerrar edición" : "Editar semana"}
          </button>
          <button className="button ghost" type="button" disabled={busy} onClick={handleSave}>Guardar borrador</button>
          <button className="button ghost" type="button" disabled={busy} onClick={handleValidate}>Validar</button>
          <button className="button dark" type="button" onClick={() => window.print()}>Exportar</button>
          <button className="button primary" type="button" disabled={busy} onClick={handlePublish}>Publicar</button>
        </div>
      </section>

      <section className="cycle-heading">
        <div>
          <span className="eyebrow">Cuadrante de 10 semanas</span>
          <h2>Semana {weekNumber}</h2>
          <p>{message}</p>
        </div>
        <label className="date-field no-print">
          <span>Inicio de Semana 1</span>
          <input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} />
        </label>
      </section>

      <nav className="week-tabs" aria-label="Semanas del ciclo">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((item) => (
          <button
            type="button"
            key={item}
            className={weekNumber === item ? "is-active" : ""}
            onClick={() => setWeekNumber(item)}
            aria-current={weekNumber === item ? "page" : undefined}
          >
            <span>S</span>{item}
          </button>
        ))}
      </nav>

      <div className={`workspace-layout${editing ? " has-sidebar" : ""}`}>
        <section className="schedule-card">
          <div className="legend no-print" aria-label="Leyenda">
            <span><i className="legend-free" />Libre</span>
            <span><i className="legend-morning" />Mañana</span>
            <span><i className="legend-afternoon" />Tarde</span>
            <span><i className="legend-exception" />Excepción</span>
            {selectedEmployee && (
              <button type="button" onClick={() => setSelectedEmployee(null)}>
                Mostrando {selectedEmployee} · limpiar
              </button>
            )}
          </div>
          <ScheduleGrid
            shifts={shifts}
            dateLabels={labels}
            selectedEmployee={selectedEmployee}
            issueDays={issueDays}
            canEditException={mode === "MANUAL_EXCEPTION"}
            onSelectEmployee={(employeeId) =>
              setSelectedEmployee((current) => current === employeeId ? null : employeeId)
            }
            onSelectShift={setSelectedShift}
          />
        </section>

        {editing && (
          <aside className="editor-sidebar no-print">
            <header>
              <div><span>{MODE_LABELS[mode]}</span><h2>Editar ciclo</h2></div>
              <div className="history-actions">
                <button type="button" disabled={history.past.length === 0} onClick={() => dispatch({ type: "UNDO" })} aria-label="Deshacer">↶</button>
                <button type="button" disabled={history.future.length === 0} onClick={() => dispatch({ type: "REDO" })} aria-label="Rehacer">↷</button>
              </div>
            </header>
            {mode === "AUTOMATIC" && (
              <>
                <p className="sidebar-intro">Asigna la Semana 1. Al cambiar un empleado, el sistema intercambia su patrón anterior para conservar diez asignaciones únicas.</p>
                <AssignmentEditor
                  assignment={history.present}
                  employees={HISTORICAL_EMPLOYEE_NAMES}
                  disabled={false}
                  onAssign={handleAssign}
                />
                <button
                  type="button"
                  className="button primary full-width"
                  onClick={() => setMessage("Ciclo completo regenerado desde la Semana 1.")}
                >
                  Generar ciclo
                </button>
              </>
            )}
            {mode === "GUIDED" && (
              <>
                <p className="sidebar-intro">Indica quién libra y el bloque exacto. Si existen variantes, podrás compararlas antes de aplicar.</p>
                <GuidedPanel
                  employees={HISTORICAL_EMPLOYEE_NAMES}
                  onChoose={(employeeId, patternId) => handleAssign(patternId, employeeId)}
                />
              </>
            )}
            {mode === "MANUAL_EXCEPTION" && (
              <div className="manual-instructions">
                <span>01</span><p>Selecciona un turno directamente en el cuadrante.</p>
                <span>02</span><p>Indica el reemplazo y un motivo explícito.</p>
                <span>03</span><p>Valida la cobertura antes de publicar otra versión.</p>
              </div>
            )}
            <div className="validation-sidebar">
              <h3>Resultado de validación</h3>
              <ValidationPanel issues={issues} />
            </div>
          </aside>
        )}
      </div>

      {selectedShift && mode === "MANUAL_EXCEPTION" && (
        <ExceptionEditor
          shift={selectedShift}
          date={isoDateFor(startsOn, weekNumber, selectedShift.day)}
          onCancel={() => setSelectedShift(null)}
          onApply={handleException}
        />
      )}
    </main>
  );
}
