"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
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
  CYCLE_WEEK_NUMBERS,
  DAYS,
  HISTORICAL_EMPLOYEE_NAMES,
  WEEK_1_ASSIGNMENT,
  materializeWeek,
  type CycleWeekNumber,
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
type PrintScope = "CURRENT" | "FULL";

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

function dateRangeLabel(startsOn: string, weekNumber: CycleWeekNumber): string {
  const formatter = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const first = new Date(`${isoDateFor(startsOn, weekNumber, "MONDAY")}T00:00:00.000Z`);
  const last = new Date(`${isoDateFor(startsOn, weekNumber, "SUNDAY")}T00:00:00.000Z`);
  return `${formatter.format(first)} — ${formatter.format(last)}`;
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
  const [weekNumber, setWeekNumber] = useState<CycleWeekNumber>(1);
  const [mode, setMode] = useState<EditorMode>("AUTOMATIC");
  const [editing, setEditing] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeId | null>(null);
  const [selectedShift, setSelectedShift] = useState<ScheduledShift | null>(null);
  const [issues, setIssues] = useState<readonly ValidationIssue[]>([]);
  const [message, setMessage] = useState("Ciclo canónico preparado para generar.");
  const [busy, setBusy] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [printScope, setPrintScope] = useState<PrintScope | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void repository.listCycles().then((cycles) => {
      const latest = [...cycles].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      )[0];
      if (!latest) return;
      setCycle(latest);
      setStartsOn(latest.startsOn);
      dispatch({
        type: "RESET",
        assignment: latest.week1Assignment,
        clearedWeekNumbers: latest.clearedWeekNumbers,
      });
      setMessage(`Borrador recuperado · ${latest.startsOn}`);
    });
  }, [repository]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExportMenuOpen(false);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !exportMenuRef.current?.contains(event.target)
      ) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [exportMenuOpen]);

  useEffect(() => {
    if (!printScope) return;
    const handleAfterPrint = () => setPrintScope(null);
    window.addEventListener("afterprint", handleAfterPrint, { once: true });
    const frame = window.requestAnimationFrame(() => {
      try {
        window.print();
      } catch {
        setPrintScope(null);
        setMessage("No se pudo abrir el diálogo de impresión.");
      }
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printScope]);

  const generated = useMemo(
    () =>
      createCyclePreview({
        week1Assignment: history.present.week1Assignment,
        rotationOrder: HISTORICAL_EMPLOYEE_NAMES,
      }),
    [history.present],
  );
  const effectiveCycle = cycle
    ? {
        ...cycle,
        startsOn,
        week1Assignment: history.present.week1Assignment,
        clearedWeekNumbers: history.present.clearedWeekNumbers,
    }
    : null;
  const shiftsForWeek = (targetWeekNumber: CycleWeekNumber) => {
    if (history.present.clearedWeekNumbers.includes(targetWeekNumber)) return [];
    if (effectiveCycle) {
      return materializeEffectiveWeek(
        effectiveCycle,
        generated,
        targetWeekNumber,
      );
    }
    const targetWeek = generated.weeks.find(
      (item) => item.weekNumber === targetWeekNumber,
    );
    return targetWeek ? materializeWeek(targetWeek, generated.patterns) : [];
  };
  const shifts = shiftsForWeek(weekNumber);
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
        week1Assignment: history.present.week1Assignment,
        clearedWeekNumbers: history.present.clearedWeekNumbers,
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

  const clearTransientEditorState = () => {
    setIssues([]);
    setSelectedEmployee(null);
    setSelectedShift(null);
  };

  const handleClearWeek = () => {
    const confirmed = window.confirm(
      `Se eliminarán todos los turnos de la Semana ${weekNumber}. Las demás semanas no cambiarán.`,
    );
    if (!confirmed) return;
    dispatch({ type: "CLEAR_WEEK", weekNumber });
    setEditing(true);
    clearTransientEditorState();
    setMessage(`Semana ${weekNumber} limpiada. Puedes deshacer la operación mientras editas.`);
  };

  const handleClearAll = () => {
    const confirmed = window.confirm(
      "Se eliminarán los turnos de las 10 semanas. Esta acción podrá deshacerse mientras continúes editando el borrador.",
    );
    if (!confirmed) return;
    dispatch({ type: "CLEAR_ALL" });
    setEditing(true);
    clearTransientEditorState();
    setMessage("Se han limpiado las 10 semanas. La fecha de inicio y los metadatos se conservan.");
  };

  const handleRegenerate = () => {
    dispatch({ type: "REGENERATE" });
    clearTransientEditorState();
    setMessage("Ciclo completo regenerado desde la asignación canónica de la Semana 1.");
  };

  const handleUndo = () => {
    dispatch({ type: "UNDO" });
    clearTransientEditorState();
    setMessage("Se ha deshecho la última modificación del ciclo.");
  };

  const handleRedo = () => {
    dispatch({ type: "REDO" });
    clearTransientEditorState();
    setMessage("Se ha rehecho la última modificación del ciclo.");
  };

  const startPrint = (scope: PrintScope) => {
    setExportMenuOpen(false);
    setPrintScope(scope);
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
    <main
      className={`app-shell print-scope-${printScope?.toLowerCase() ?? "none"}`}
    >
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
          <button
            className="button danger"
            type="button"
            disabled={busy || history.present.clearedWeekNumbers.includes(weekNumber)}
            onClick={handleClearWeek}
          >
            Limpiar semana
          </button>
          <button
            className="button danger"
            type="button"
            disabled={busy || history.present.clearedWeekNumbers.length === 10}
            onClick={handleClearAll}
          >
            Limpiar todas
          </button>
          <button className="button ghost" type="button" disabled={busy} onClick={handleSave}>Guardar borrador</button>
          <button className="button ghost" type="button" disabled={busy} onClick={handleValidate}>Validar</button>
          <div className="export-menu" ref={exportMenuRef}>
            <button
              className="button dark"
              type="button"
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen}
              aria-controls="export-options"
              onClick={() => setExportMenuOpen((current) => !current)}
            >
              Exportar
            </button>
            {exportMenuOpen && (
              <div className="export-options" id="export-options" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => startPrint("CURRENT")}
                >
                  Exportar semana actual
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => startPrint("FULL")}
                >
                  Exportar ciclo completo
                </button>
              </div>
            )}
          </div>
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
        {CYCLE_WEEK_NUMBERS.map((item) => (
          <button
            type="button"
            key={item}
            className={weekNumber === item ? "is-active" : ""}
            onClick={() => setWeekNumber(item)}
            aria-label={`Semana ${item}`}
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
                <button type="button" disabled={history.past.length === 0} onClick={handleUndo} aria-label="Deshacer">↶</button>
                <button type="button" disabled={history.future.length === 0} onClick={handleRedo} aria-label="Rehacer">↷</button>
              </div>
            </header>
            {mode === "AUTOMATIC" && (
              <>
                <p className="sidebar-intro">Asigna la Semana 1. Al cambiar un empleado, el sistema intercambia su patrón anterior para conservar diez asignaciones únicas.</p>
                <AssignmentEditor
                  assignment={history.present.week1Assignment}
                  employees={HISTORICAL_EMPLOYEE_NAMES}
                  disabled={false}
                  onAssign={handleAssign}
                />
                <button
                  type="button"
                  className="button primary full-width"
                  onClick={handleRegenerate}
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

      {printScope === "FULL" && (
        <section
          className="full-cycle-print"
          aria-label="Vista de impresión del ciclo completo"
        >
          {CYCLE_WEEK_NUMBERS.map((item) => (
            <article className="print-week" key={item}>
              <header className="print-week-heading">
                <span>Cuadrante de 10 semanas</span>
                <h2>Semana {item}</h2>
                <p>{dateRangeLabel(startsOn, item)}</p>
              </header>
              <div className="schedule-card">
                <ScheduleGrid
                  ariaLabel={`Cuadrante semanal de la Semana ${item} para impresión`}
                  shifts={shiftsForWeek(item)}
                  dateLabels={dateLabels(startsOn, item)}
                  selectedEmployee={null}
                  issueDays={new Set<Day>()}
                  canEditException={false}
                  onSelectEmployee={() => undefined}
                  onSelectShift={() => undefined}
                />
              </div>
            </article>
          ))}
        </section>
      )}

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
