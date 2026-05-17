export type SupportedLocale = "bn" | "en";

const bengaliDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"] as const;

export function toBengaliNumerals(input: string | number): string {
  return String(input).replace(/\d/g, (digit) => bengaliDigits[Number(digit)] ?? digit);
}

export function toLatinNumerals(input: string): string {
  return input.replace(/[০-৯]/g, (digit) => String(bengaliDigits.indexOf(digit as never)));
}

export function formatIndianNumber(value: number): string {
  const [whole = "0", fraction] = String(Math.abs(value)).split(".");
  const lastThree = whole.slice(-3);
  const otherDigits = whole.slice(0, -3);
  const grouped =
    otherDigits.length > 0
      ? `${otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${lastThree}`
      : lastThree;

  return fraction ? `${grouped}.${fraction}` : grouped;
}

export function formatMoney(amountPaisa: number | bigint, locale: SupportedLocale = "bn"): string {
  const amount = typeof amountPaisa === "bigint" ? Number(amountPaisa) : amountPaisa;
  const isNegative = amount < 0;
  const absolutePaisa = Math.abs(amount);
  const taka = Math.floor(absolutePaisa / 100);
  const paisa = absolutePaisa % 100;
  const decimal = paisa > 0 ? `.${String(paisa).padStart(2, "0")}` : "";
  const formatted = `${isNegative ? "-" : ""}৳ ${formatIndianNumber(taka)}${decimal}`;

  return locale === "bn" ? toBengaliNumerals(formatted) : formatted;
}
