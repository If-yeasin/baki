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

  it("keeps settlement copy away from wallet/custody positioning", () => {
    const settlementKeys = Object.keys(en).filter((key) => key.startsWith("settle."));
    const englishWalletPattern = /\bwallet\b/i;
    const bengaliWalletPattern = /ও[য়য়]ালেট/;

    for (const key of settlementKeys) {
      expect(en[key as keyof typeof en], key).not.toMatch(englishWalletPattern);
      expect(bn[key as keyof typeof bn], key).not.toMatch(bengaliWalletPattern);
    }
  });
});
