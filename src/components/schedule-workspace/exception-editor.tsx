import { useState } from "react";
import type { MorningStart, PatternDay, ScheduledShift, ShiftKind } from "@/domain/scheduling";

export function ExceptionEditor({
  shift,
  date,
  onCancel,
  onApply,
}: {
  readonly shift: ScheduledShift;
  readonly date: string;
  readonly onCancel: () => void;
  readonly onApply: (replacement: PatternDay, reason: string) => void;
}) {
  const [kind, setKind] = useState<ShiftKind>(shift.kind);
  const [startTime, setStartTime] = useState<MorningStart>(
    shift.kind === "MORNING" ? shift.startTime : "08:00",
  );
  const [reason, setReason] = useState("");
  const replacement: PatternDay = kind === "MORNING"
    ? { day: shift.day, kind, startTime }
    : { day: shift.day, kind, startTime: null };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="exception-dialog" role="dialog" aria-modal="true" aria-labelledby="exception-title">
        <header>
          <div><small>Excepción puntual · {date}</small><h2 id="exception-title">{shift.employeeId}</h2></div>
          <button type="button" onClick={onCancel} aria-label="Cerrar">×</button>
        </header>
        <div className="original-shift">
          <span>Turno original</span>
          <strong>{shift.kind === "FREE" ? "Libre" : shift.kind === "AFTERNOON" ? "Tarde" : `Mañana · ${shift.startTime}`}</strong>
        </div>
        <label className="field-label">
          Sustituir por
          <select value={kind} onChange={(event) => setKind(event.target.value as ShiftKind)}>
            <option value="FREE">Libre</option>
            <option value="MORNING">Mañana</option>
            <option value="AFTERNOON">Tarde</option>
          </select>
        </label>
        {kind === "MORNING" && (
          <label className="field-label">
            Hora de entrada
            <select value={startTime} onChange={(event) => setStartTime(event.target.value as MorningStart)}>
              <option>05:30</option><option>07:00</option><option>08:00</option>
            </select>
          </label>
        )}
        <label className="field-label">
          Motivo obligatorio
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe por qué se autoriza el cambio" rows={3} />
        </label>
        <footer>
          <button type="button" className="button ghost" onClick={onCancel}>Cancelar</button>
          <button type="button" className="button primary" disabled={reason.trim().length < 3} onClick={() => onApply(replacement, reason)}>
            Registrar excepción
          </button>
        </footer>
      </section>
    </div>
  );
}
