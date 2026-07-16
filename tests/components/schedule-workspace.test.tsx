import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ScheduleWorkspace } from "@/components/schedule-workspace/schedule-workspace";

describe("cuadrante principal", () => {
  beforeEach(() => localStorage.clear());

  it("muestra la semana canónica y permite navegar a Semana 10", () => {
    render(<ScheduleWorkspace />);
    const grid = screen.getByLabelText("Cuadrante semanal");
    expect(within(grid).getByText("Lunes")).toBeInTheDocument();
    expect(within(grid).getByLabelText("ROCIO, turno de mañana a las 05:30")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "10" }));
    expect(screen.getByRole("heading", { name: "Semana 10" })).toBeInTheDocument();
  });

  it("abre el editor automático con asignaciones de Semana 1", () => {
    render(<ScheduleWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Editar semana" }));
    expect(screen.getByRole("heading", { name: "Editar ciclo" })).toBeInTheDocument();
    expect(screen.getByLabelText("Empleado para P01")).toHaveValue("ROE");
  });
});
