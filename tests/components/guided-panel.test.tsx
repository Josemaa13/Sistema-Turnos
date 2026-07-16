import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GuidedPanel } from "@/components/pattern-picker/guided-panel";
import { HISTORICAL_EMPLOYEE_NAMES } from "@/domain/scheduling";

describe("edición guiada", () => {
  it("muestra las dos variantes de martes-miércoles y aplica la elegida", () => {
    const onChoose = vi.fn();
    render(
      <GuidedPanel
        employees={HISTORICAL_EMPLOYEE_NAMES}
        onChoose={onChoose}
      />,
    );
    fireEvent.click(screen.getByTitle("MONDAY"));
    fireEvent.click(screen.getByTitle("WEDNESDAY"));
    expect(screen.getByText("P02")).toBeInTheDocument();
    expect(screen.getByText("P07")).toBeInTheDocument();
    fireEvent.click(screen.getByText("P07").closest("button")!);
    expect(onChoose).toHaveBeenCalledWith("RO", "P07");
  });
});
