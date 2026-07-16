export class ApplicationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class CycleNotFoundError extends ApplicationError {
  constructor(cycleId: string) {
    super("CYCLE_NOT_FOUND", `No existe el ciclo "${cycleId}".`);
  }
}

export class InvalidCycleDateError extends ApplicationError {
  constructor(message: string) {
    super("INVALID_CYCLE_DATE", message);
  }
}

export class PublicationBlockedError extends ApplicationError {
  constructor(messages: readonly string[]) {
    super(
      "PUBLICATION_BLOCKED",
      `No se puede publicar hasta corregir: ${messages.join(" ")}`,
    );
  }
}

export class InvalidExceptionError extends ApplicationError {
  constructor(message: string) {
    super("INVALID_EXCEPTION", message);
  }
}
