import { PaymentInputError } from "./errors";

const BD_PHONE_PATTERN = /^\+8801[3-9]\d{8}$/;

export function paisaToTaka(amountPaisa: number): string {
  if (!Number.isInteger(amountPaisa) || amountPaisa <= 0) {
    throw new PaymentInputError("amount_paisa_must_be_positive_integer");
  }

  return (amountPaisa / 100).toFixed(amountPaisa % 100 === 0 ? 0 : 2);
}

function attemptNormalize(input: string): string {
  const digits = input.replace(/\D/g, "");

  if (digits.startsWith("880")) {
    return `+${digits}`;
  }

  if (digits.startsWith("01")) {
    return `+880${digits.slice(1)}`;
  }

  return input;
}

export function normalizeBdPhone(input: string): string {
  const candidate = attemptNormalize(input);

  if (!BD_PHONE_PATTERN.test(candidate)) {
    throw new PaymentInputError("invalid_bd_phone");
  }

  return candidate;
}

export function isValidBdPhone(input: string): boolean {
  if (typeof input !== "string" || input.length === 0) {
    return false;
  }
  return BD_PHONE_PATTERN.test(attemptNormalize(input));
}

export function maskMfsNumber(input: string): string {
  // Best-effort masking — do not throw from a logging helper. If we can
  // normalize, mask the middle digits; otherwise return a placeholder so
  // we never accidentally surface the raw input in logs.
  let normalized: string;
  try {
    normalized = normalizeBdPhone(input);
  } catch {
    return "+880**********";
  }
  return normalized.replace(/(\+8801\d{2})\d{4}(\d{3})/, "$1****$2");
}
