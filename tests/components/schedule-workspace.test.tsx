import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScheduleWorkspace } from "@/components/schedule-workspace/schedule-workspace";

describe("cuadrante principal", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("muestra la semana canónica y permite navegar a Semana 10", () => {
    render(<ScheduleWorkspace />);
    const grid = screen.getByLabelText("Cuadrante semanal");
    expect(within(grid).getByText("Lunes")).toBeInTheDocument();
    expect(
      within(grid).getByLabelText("ROCIO, turno de mañana a las 05:30"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Semana 10" }));
    expect(screen.getByRole("heading", { name: "Semana 10" })).toBeInTheDocument();
  });

  it("abre el editor automático con asignaciones de Semana 1", () => {
    render(<ScheduleWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Editar semana" }));
    expect(screen.getByRole("heading", { name: "Editar ciclo" })).toBeInTheDocument();
    expect(screen.getByLabelText("Empleado para P01")).toHaveValue("ROE");
  });

  it("limpia solo la semana visible y permite deshacer y rehacer", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ScheduleWorkspace />);
    const grid = screen.getByLabelText("Cuadrante semanal");

    fireEvent.click(screen.getByRole("button", { name: "Limpiar semana" }));
    expect(confirm).toHaveBeenCalledWith(
      "Se eliminarán todos los turnos de la Semana 1. Las demás semanas no cambiarán.",
    );
    expect(within(grid).queryAllByRole("button")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Semana 2" }));
    expect(within(grid).getAllByRole("button").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Semana 1" }));

    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(within(grid).getAllByRole("button").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Rehacer" }));
    expect(within(grid).queryAllByRole("button")).toHaveLength(0);
  });

  it("limpia las diez semanas y conserva la operación en el historial", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ScheduleWorkspace />);
    const grid = screen.getByLabelText("Cuadrante semanal");

    fireEvent.click(screen.getByRole("button", { name: "Limpiar todas" }));
    expect(within(grid).queryAllByRole("button")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Semana 10" }));
    expect(within(grid).queryAllByRole("button")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(within(grid).getAllByRole("button").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Rehacer" }));
    expect(within(grid).queryAllByRole("button")).toHaveLength(0);
  });

  it("regenera las semanas limpiadas y permite deshacer la regeneración", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<ScheduleWorkspace />);
    const grid = screen.getByLabelText("Cuadrante semanal");

    fireEvent.click(screen.getByRole("button", { name: "Limpiar semana" }));
    expect(within(grid).queryAllByRole("button")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Generar ciclo" }));
    expect(within(grid).getAllByRole("button").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(within(grid).queryAllByRole("button")).toHaveLength(0);
  });

  it("persiste una semana limpiada al guardar y recargar", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const firstRender = render(<ScheduleWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Limpiar semana" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));

    await waitFor(() =>
      expect(localStorage.getItem("sistema-turnos:v1")).not.toBeNull(),
    );
    firstRender.unmount();
    render(<ScheduleWorkspace />);

    const grid = screen.getByLabelText("Cuadrante semanal");
    await waitFor(() => expect(within(grid).queryAllByRole("button")).toHaveLength(0));
    fireEvent.click(screen.getByRole("button", { name: "Semana 2" }));
    expect(within(grid).getAllByRole("button").length).toBeGreaterThan(0);
  });

  it("ofrece ambos alcances y exporta solo la semana actual", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    render(<ScheduleWorkspace />);

    const exportButton = screen.getByRole("button", { name: "Exportar" });
    fireEvent.click(exportButton);
    expect(exportButton).toHaveAttribute("aria-haspopup", "menu");
    expect(exportButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "Exportar semana actual" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Exportar ciclo completo" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
    fireEvent.click(exportButton);

    fireEvent.click(screen.getByRole("menuitem", { name: "Exportar semana actual" }));
    await waitFor(() => expect(print).toHaveBeenCalledOnce());
    expect(document.querySelector("main")).toHaveClass("print-scope-current");
    expect(document.querySelector(".full-cycle-print")).not.toBeInTheDocument();

    fireEvent(window, new Event("afterprint"));
    expect(document.querySelector("main")).toHaveClass("print-scope-none");
  });

  it("renderiza las diez semanas para imprimir y deja vacías las limpiadas", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    render(<ScheduleWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Limpiar semana" }));
    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Exportar ciclo completo" }));
    await waitFor(() => expect(print).toHaveBeenCalledOnce());

    const printView = document.querySelector<HTMLElement>(
      '[aria-label="Vista de impresión del ciclo completo"]',
    );
    expect(printView).not.toBeNull();
    expect(printView?.querySelectorAll("article")).toHaveLength(10);
    expect(
      [...(printView?.querySelectorAll("article h2") ?? [])].map(
        (heading) => heading.textContent,
      ),
    ).toEqual(Array.from({ length: 10 }, (_, index) => `Semana ${index + 1}`));

    const clearedGrid = printView?.querySelector(
      '[aria-label="Cuadrante semanal de la Semana 1 para impresión"]',
    );
    const populatedGrid = printView?.querySelector(
      '[aria-label="Cuadrante semanal de la Semana 2 para impresión"]',
    );
    expect(clearedGrid?.querySelectorAll("button")).toHaveLength(0);
    expect(populatedGrid?.querySelectorAll("button").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Semana 1" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
