import { describe, expect, it } from "vitest";

import { EXPENSE_CATEGORIES, isExpenseCategory } from "./types";

describe("isExpenseCategory", () => {
  it("accepts every known category", () => {
    for (const category of EXPENSE_CATEGORIES) {
      expect(isExpenseCategory(category)).toBe(true);
    }
  });

  it("rejects unknown values", () => {
    expect(isExpenseCategory("garbage")).toBe(false);
    expect(isExpenseCategory("")).toBe(false);
  });
});
