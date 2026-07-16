import { DAYS, type Day, type ShiftPattern, type ValidationIssue } from "./types";

interface ExpectedCoverage {
  readonly free: number;
  readonly morning: number;
  readonly afternoon: number;
  readonly starts: Readonly<Record<"05:30" | "07:00" | "08:00", number>>;
}

export const EXPECTED_DAILY_COVERAGE: Readonly<Record<Day, ExpectedCoverage>> = {
  MONDAY: { free: 2, morning: 5, afternoon: 3, starts: { "05:30": 1, "07:00": 1, "08:00": 3 } },
  TUESDAY: { free: 3, morning: 4, afternoon: 3, starts: { "05:30": 1, "07:00": 1, "08:00": 2 } },
  WEDNESDAY: { free: 3, morning: 4, afternoon: 3, starts: { "05:30": 1, "07:00": 1, "08:00": 2 } },
  THURSDAY: { free: 3, morning: 4, afternoon: 3, starts: { "05:30": 1, "07:00": 1, "08:00": 2 } },
  FRIDAY: { free: 3, morning: 4, afternoon: 3, starts: { "05:30": 1, "07:00": 1, "08:00": 2 } },
  SATURDAY: { free: 3, morning: 4, afternoon: 3, starts: { "05:30": 1, "07:00": 1, "08:00": 2 } },
  SUNDAY: { free: 3, morning: 4, afternoon: 3, starts: { "05:30": 0, "07:00": 1, "08:00": 3 } },
};

function issue(
  code: string,
  message: string,
  context: { readonly day?: Day | undefined; readonly patternId?: ShiftPattern["id"] | undefined } = {},
): ValidationIssue {
  return {
    code,
    severity: "ERROR",
    message,
    ...(context.day ? { day: context.day } : {}),
    ...(context.patternId ? { patternId: context.patternId } : {}),
  };
}

function validateRestSequence(pattern: ShiftPattern): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const freeIndices = pattern.days
    .map((value, index) => (value.kind === "FREE" ? index : -1))
    .filter((index) => index >= 0);
  if (freeIndices.length !== 2) return issues;

  const [first, second] = freeIndices;
  if (first === undefined || second === undefined) return issues;
  const consecutive = second === first + 1 || (first === 0 && second === 6);
  if (!consecutive) {
    issues.push(
      issue(
        "NON_CONSECUTIVE_FREE_DAYS",
        `${pattern.id} debe tener dos días libres consecutivos, incluyendo domingo-lunes.`,
        { patternId: pattern.id },
      ),
    );
    return issues;
  }

  const start = first === 0 && second === 6 ? 6 : first;
  const dayBefore = pattern.days[(start + 6) % 7];
  const twoDaysBefore = pattern.days[(start + 5) % 7];
  const dayAfter = pattern.days[(start + 2) % 7];
  const isCanonicalP08Exception = pattern.tags.includes("SPECIAL_THU_FRI");

  if (dayBefore?.kind !== "MORNING") {
    issues.push(
      issue(
        "REST_PRECEDING_SHIFT_NOT_MORNING",
        `${pattern.id} debe trabajar de mañana justo antes del descanso.`,
        { patternId: pattern.id, day: dayBefore?.day },
      ),
    );
  }
  // P08 is preserved exactly as the authoritative canonical seed. Its second
  // pre-rest shift is the single documented contradiction in the source spec.
  if (!isCanonicalP08Exception && twoDaysBefore?.kind !== "MORNING") {
    issues.push(
      issue(
        "SECOND_REST_PRECEDING_SHIFT_NOT_MORNING",
        `${pattern.id} debe trabajar de mañana los dos turnos previos al descanso.`,
        { patternId: pattern.id, day: twoDaysBefore?.day },
      ),
    );
  }

  const hasMorningReturn =
    pattern.tags.includes("SPECIAL_TUE_WED") || isCanonicalP08Exception;
  const expectedReturn = hasMorningReturn ? "MORNING" : "AFTERNOON";
  if (dayAfter?.kind !== expectedReturn) {
    issues.push(
      issue(
        "INVALID_POST_REST_RETURN",
        `${pattern.id} debe volver de ${expectedReturn === "MORNING" ? "mañana" : "tarde"} después del descanso.`,
        { patternId: pattern.id, day: dayAfter?.day },
      ),
    );
  }
  return issues;
}

export function validatePatternSet(
  patterns: readonly ShiftPattern[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (patterns.length !== 10) {
    issues.push(
      issue(
        "PATTERN_COUNT",
        `La plantilla debe contener exactamente 10 patrones; contiene ${patterns.length}.`,
      ),
    );
  }

  const ids = patterns.map((pattern) => pattern.id);
  if (new Set(ids).size !== ids.length) {
    issues.push(issue("DUPLICATE_PATTERN", "Cada patrón debe tener un ID único."));
  }

  for (const pattern of patterns) {
    if (pattern.days.length !== 7) {
      issues.push(
        issue("PATTERN_DAY_COUNT", `${pattern.id} debe contener siete días.`, {
          patternId: pattern.id,
        }),
      );
      continue;
    }
    pattern.days.forEach((value, index) => {
      const runtimeValue = value as {
        readonly day: Day;
        readonly kind: string;
        readonly startTime: unknown;
      };
      if (value.day !== DAYS[index]) {
        issues.push(
          issue(
            "NON_CANONICAL_DAY_ORDER",
            `${pattern.id} debe usar los siete días en el orden canónico.`,
            { patternId: pattern.id, day: value.day },
          ),
        );
      }
      if (
        runtimeValue.kind === "MORNING" &&
        !["05:30", "07:00", "08:00"].includes(String(runtimeValue.startTime))
      ) {
        issues.push(
          issue("MORNING_WITHOUT_VALID_START", `${pattern.id} contiene una mañana sin hora válida.`, {
            patternId: pattern.id,
            day: value.day,
          }),
        );
      }
      if (runtimeValue.kind !== "MORNING" && runtimeValue.startTime !== null) {
        issues.push(
          issue("START_ON_NON_MORNING", `${pattern.id} contiene una hora en un turno no matinal.`, {
            patternId: pattern.id,
            day: value.day,
          }),
        );
      }
    });

    const free = pattern.days.filter((value) => value.kind === "FREE").length;
    if (free !== 2) {
      issues.push(
        issue("PATTERN_FREE_COUNT", `${pattern.id} debe tener exactamente dos días libres.`, {
          patternId: pattern.id,
        }),
      );
    }
    if (pattern.days.length - free !== 5) {
      issues.push(
        issue("PATTERN_WORK_COUNT", `${pattern.id} debe tener exactamente cinco jornadas.`, {
          patternId: pattern.id,
        }),
      );
    }
    issues.push(...validateRestSequence(pattern));
  }

  for (const day of DAYS) {
    const values = patterns.flatMap((pattern) =>
      pattern.days.filter((value) => value.day === day),
    );
    const actual = {
      free: values.filter((value) => value.kind === "FREE").length,
      morning: values.filter((value) => value.kind === "MORNING").length,
      afternoon: values.filter((value) => value.kind === "AFTERNOON").length,
      starts: {
        "05:30": values.filter((value) => value.startTime === "05:30").length,
        "07:00": values.filter((value) => value.startTime === "07:00").length,
        "08:00": values.filter((value) => value.startTime === "08:00").length,
      },
    };
    const expected = EXPECTED_DAILY_COVERAGE[day];
    for (const key of ["free", "morning", "afternoon"] as const) {
      if (actual[key] !== expected[key]) {
        issues.push(
          issue(
            `DAILY_${key.toUpperCase()}_COVERAGE`,
            `${day}: se requieren ${expected[key]} turnos ${key} y hay ${actual[key]}.`,
            { day },
          ),
        );
      }
    }
    for (const start of ["05:30", "07:00", "08:00"] as const) {
      if (actual.starts[start] !== expected.starts[start]) {
        issues.push(
          issue(
            "DAILY_MORNING_START_COVERAGE",
            `${day}: se requieren ${expected.starts[start]} entradas a las ${start} y hay ${actual.starts[start]}.`,
            { day },
          ),
        );
      }
    }
  }

  return issues;
}
