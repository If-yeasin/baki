export function paisaToTaka(amountPaisa: number): string {
  if (!Number.isInteger(amountPaisa) || amountPaisa <= 0) {
    throw new Error("amount_paisa_must_be_positive_integer");
  }

  return (amountPaisa / 100).toFixed(amountPaisa % 100 === 0 ? 0 : 2);
}

export function normalizeBdPhone(input: string): string {
  const digits = input.replace(/\D/g, "");

  if (digits.startsWith("880")) {
    return `+${digits}`;
  }

  if (digits.startsWith("01")) {
    return `+880${digits.slice(1)}`;
  }

  return input;
}

export function maskMfsNumber(input: string): string {
  const normalized = normalizeBdPhone(input);
  return normalized.replace(/(\+8801\d{2})\d{4}(\d{3})/, "$1****$2");
}
