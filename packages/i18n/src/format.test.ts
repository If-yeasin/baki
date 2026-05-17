import { describe, expect, it } from "vitest";

import {
  formatDhakaDate,
  formatMoney,
  formatRelativeDhakaDate,
  toBengaliNumerals,
  toLatinNumerals
} from "./format";

describe("number formatting", () => {
  it("converts Latin digits to Bengali numerals", () => {
    expect(toBengaliNumerals("BDT 1234567890.50")).toBe("BDT ১২৩৪৫৬৭৮৯০.৫০");
  });

  it("converts Bengali numerals back to Latin digits", () => {
    expect(toLatinNumerals("৳ ১,২৩,৪৫০.৫০")).toBe("৳ 1,23,450.50");
  });
});

describe("money formatting", () => {
  it("formats BDT with Indian grouping and Bengali numerals by default", () => {
    expect(formatMoney(12_345_000)).toBe("৳ ১,২৩,৪৫০");
  });

  it("formats English money without changing the BDT symbol", () => {
    expect(formatMoney(12_345_000, "en")).toBe("৳ 1,23,450");
  });

  it("keeps paisa and negative amounts readable", () => {
    expect(formatMoney(-1_234_567, "bn")).toBe("-৳ ১২,৩৪৫.৬৭");
  });

  it("formats bigint paisa without losing precision", () => {
    expect(formatMoney(900_719_925_474_099_312n, "en")).toBe("৳ 9,00,71,99,25,47,40,993.12");
  });
});

describe("Dhaka date formatting", () => {
  it("formats absolute dates with Bengali numerals", () => {
    expect(formatDhakaDate("2026-05-10T00:00:00.000Z", "bn")).toBe("১০ মে, ২০২৬");
    expect(formatDhakaDate("2026-05-10T00:00:00.000Z", "en")).toBe("May 10, 2026");
  });

  it("uses Asia/Dhaka boundaries for today and yesterday", () => {
    const now = "2026-05-17T18:30:00.000Z"; // May 18 in Dhaka

    expect(formatRelativeDhakaDate("2026-05-17T18:05:00.000Z", "en", now)).toBe("Today");
    expect(formatRelativeDhakaDate("2026-05-17T17:55:00.000Z", "en", now)).toBe("Yesterday");
  });

  it("uses relative Bengali labels for two to six days ago", () => {
    const now = "2026-05-17T12:00:00.000Z";

    expect(formatRelativeDhakaDate("2026-05-14T06:00:00.000Z", "bn", now)).toBe("৩ দিন আগে");
    expect(formatRelativeDhakaDate("2026-05-11T06:00:00.000Z", "en", now)).toBe("6 days ago");
  });

  it("falls back to absolute dates after six days", () => {
    const now = "2026-05-17T12:00:00.000Z";
    const oldDate = "2026-05-10T06:00:00.000Z";

    expect(formatRelativeDhakaDate(oldDate, "bn", now)).toBe(formatDhakaDate(oldDate, "bn"));
  });
});
