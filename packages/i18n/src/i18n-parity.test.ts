import { describe, expect, it } from "vitest";

import bn from "./bn.json";
import en from "./en.json";

describe("translation catalogs", () => {
  it("keeps Bengali and English keys in parity", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(bn).sort());
  });

  it("keeps interpolation placeholders in parity", () => {
    const placeholderPattern = /\{\{(\w+)\}\}/g;

    for (const key of Object.keys(en)) {
      const englishPlaceholders = Array.from(en[key as keyof typeof en].matchAll(placeholderPattern))
        .map((match) => match[1])
        .sort();
      const bengaliPlaceholders = Array.from(bn[key as keyof typeof bn].matchAll(placeholderPattern))
        .map((match) => match[1])
        .sort();

      expect(bengaliPlaceholders, key).toEqual(englishPlaceholders);
    }
  });
});
