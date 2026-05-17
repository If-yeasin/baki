export type SupportedLocale = "bn" | "en";

const bengaliDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"] as const;
const banglaMonths = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর"
] as const;
const englishMonths = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;
const dhakaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Dhaka",
  year: "numeric"
});
const millisecondsPerDay = 24 * 60 * 60 * 1000;

export type DateInput = Date | number | string;

export function toBengaliNumerals(input: string | number): string {
  return String(input).replace(/\d/g, (digit) => bengaliDigits[Number(digit)] ?? digit);
}

export function toLatinNumerals(input: string): string {
  return input.replace(/[০-৯]/g, (digit) => String(bengaliDigits.indexOf(digit as never)));
}

function formatIndianIntegerString(whole: string): string {
  const lastThree = whole.slice(-3);
  const otherDigits = whole.slice(0, -3);

  return otherDigits.length > 0
    ? `${otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${lastThree}`
    : lastThree;
}

export function formatIndianNumber(value: number): string {
  const [whole = "0", fraction] = String(Math.abs(value)).split(".");
  const grouped = formatIndianIntegerString(whole);

  return fraction ? `${grouped}.${fraction}` : grouped;
}

export function formatMoney(amountPaisa: number | bigint, locale: SupportedLocale = "bn"): string {
  if (typeof amountPaisa === "bigint") {
    const isNegative = amountPaisa < 0n;
    const absolutePaisa = isNegative ? -amountPaisa : amountPaisa;
    const taka = absolutePaisa / 100n;
    const paisa = absolutePaisa % 100n;
    const decimal = paisa > 0n ? `.${paisa.toString().padStart(2, "0")}` : "";
    const formatted = `${isNegative ? "-" : ""}৳ ${formatIndianIntegerString(taka.toString())}${decimal}`;

    return locale === "bn" ? toBengaliNumerals(formatted) : formatted;
  }

  if (!Number.isFinite(amountPaisa)) {
    throw new RangeError("Invalid money amount");
  }

  const isNegative = amountPaisa < 0;
  const absolutePaisa = Math.abs(amountPaisa);
  const taka = Math.floor(absolutePaisa / 100);
  const paisa = absolutePaisa % 100;
  const decimal = paisa > 0 ? `.${String(paisa).padStart(2, "0")}` : "";
  const formatted = `${isNegative ? "-" : ""}৳ ${formatIndianIntegerString(String(taka))}${decimal}`;

  return locale === "bn" ? toBengaliNumerals(formatted) : formatted;
}

function toDate(input: DateInput): Date {
  const date = input instanceof Date ? input : new Date(input);

  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid date");
  }

  return date;
}

function getDhakaDateParts(input: DateInput): { day: number; month: number; year: number } {
  const parts = dhakaDateFormatter.formatToParts(toDate(input));
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type === "day" || part.type === "month" || part.type === "year")
      .map((part) => [part.type, Number(part.value)])
  ) as { day: number; month: number; year: number };

  return values;
}

function toUtcDayIndex(parts: { day: number; month: number; year: number }): number {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / millisecondsPerDay);
}

export function formatDhakaDate(input: DateInput, locale: SupportedLocale = "bn"): string {
  const { day, month, year } = getDhakaDateParts(input);

  if (locale === "bn") {
    return `${toBengaliNumerals(day)} ${banglaMonths[month - 1]}, ${toBengaliNumerals(year)}`;
  }

  return `${englishMonths[month - 1]} ${day}, ${year}`;
}

export function formatRelativeDhakaDate(
  input: DateInput,
  locale: SupportedLocale = "bn",
  now: DateInput = new Date()
): string {
  const targetDay = toUtcDayIndex(getDhakaDateParts(input));
  const today = toUtcDayIndex(getDhakaDateParts(now));
  const daysAgo = today - targetDay;

  if (daysAgo === 0) {
    return locale === "bn" ? "আজ" : "Today";
  }

  if (daysAgo === 1) {
    return locale === "bn" ? "গতকাল" : "Yesterday";
  }

  if (daysAgo >= 2 && daysAgo <= 6) {
    return locale === "bn" ? `${toBengaliNumerals(daysAgo)} দিন আগে` : `${daysAgo} days ago`;
  }

  return formatDhakaDate(input, locale);
}
