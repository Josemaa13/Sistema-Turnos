import {
  InvalidRotationOrderError,
  UnknownEmployeeError,
} from "./errors";
import type { EmployeeId } from "./types";

export function validateRotationOrder(
  rotationOrder: readonly EmployeeId[],
): void {
  if (rotationOrder.length !== 10) {
    throw new InvalidRotationOrderError(
      `El orden de rotación debe contener exactamente 10 empleados; contiene ${rotationOrder.length}.`,
    );
  }
  if (new Set(rotationOrder).size !== rotationOrder.length) {
    throw new InvalidRotationOrderError(
      "El orden de rotación contiene empleados duplicados.",
    );
  }
  if (rotationOrder.some((employeeId) => employeeId.trim().length === 0)) {
    throw new InvalidRotationOrderError(
      "El orden de rotación no puede contener identificadores vacíos.",
    );
  }
}

export function rotateEmployee(
  employeeId: EmployeeId,
  weeksToAdvance: number,
  rotationOrder: readonly EmployeeId[],
): EmployeeId {
  const index = rotationOrder.indexOf(employeeId);
  if (index < 0) throw new UnknownEmployeeError(employeeId);
  const normalizedAdvance =
    ((weeksToAdvance % rotationOrder.length) + rotationOrder.length) %
    rotationOrder.length;
  const rotated = rotationOrder[(index + normalizedAdvance) % rotationOrder.length];
  if (!rotated) throw new UnknownEmployeeError(employeeId);
  return rotated;
}
