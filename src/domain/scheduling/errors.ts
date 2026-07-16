export class SchedulingDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnknownEmployeeError extends SchedulingDomainError {
  constructor(employeeId: string) {
    super(
      "UNKNOWN_EMPLOYEE",
      `El empleado "${employeeId}" no pertenece al orden de rotación.`,
    );
  }
}

export class InvalidRotationOrderError extends SchedulingDomainError {
  constructor(message: string) {
    super("INVALID_ROTATION_ORDER", message);
  }
}

export class InvalidWeekAssignmentError extends SchedulingDomainError {
  constructor(message: string) {
    super("INVALID_WEEK_1_ASSIGNMENT", message);
  }
}

export class InvalidPatternSetError extends SchedulingDomainError {
  constructor(message: string) {
    super("INVALID_PATTERN_SET", message);
  }
}
