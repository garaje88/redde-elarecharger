/** Thrown when an input is outside what the engine can calculate. `field` names the input. */
export class CalcInputError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "CalcInputError";
    this.field = field;
  }
}

export function assertInRange(field: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new CalcInputError(field, `${field} must be between ${min} and ${max}, got ${value}.`);
  }
}

export function assertPositive(field: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new CalcInputError(field, `${field} must be a positive number, got ${value}.`);
  }
}

export function assertNonNegative(field: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new CalcInputError(field, `${field} must be zero or positive, got ${value}.`);
  }
}
