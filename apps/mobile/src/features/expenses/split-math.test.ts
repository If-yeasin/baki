import { describe, expect, it } from "vitest";

import {
  SplitMathError,
  splitEqual,
  splitExact,
  splitPercent,
  splitShares
} from "./split-math";

describe("splitEqual", () => {
  it("divides 1000 paisa across 3 members with remainder on the first", () => {
    const shares = splitEqual(1000, ["a", "b", "c"]);

    expect(shares).toEqual({ a: 334, b: 333, c: 333 });
    const total = Object.values(shares).reduce((sum, value) => sum + value, 0);
    expect(total).toBe(1000);
  });

  it("routes the remainder to the payer when provided", () => {
    const shares = splitEqual(1000, ["a", "b", "c"], { payerId: "b" });

    expect(shares).toEqual({ a: 333, b: 334, c: 333 });
  });

  it("sums exactly back for a larger amount across 4 members", () => {
    const shares = splitEqual(1_234_567, ["a", "b", "c", "d"]);
    const total = Object.values(shares).reduce((sum, value) => sum + value, 0);

    expect(total).toBe(1_234_567);
  });

  it("rejects non-positive amounts", () => {
    expect(() => splitEqual(0, ["a"])).toThrow(SplitMathError);
    expect(() => splitEqual(-1, ["a"])).toThrow(SplitMathError);
  });

  it("rejects empty member list", () => {
    expect(() => splitEqual(100, [])).toThrow(SplitMathError);
  });
});

describe("splitExact", () => {
  it("accepts shares that sum to the amount", () => {
    const shares = splitExact(900, { a: 300, b: 300, c: 300 });

    expect(shares).toEqual({ a: 300, b: 300, c: 300 });
  });

  it("rejects mismatched sum with code shares_must_sum", () => {
    try {
      splitExact(1000, { a: 400, b: 400, c: 100 });
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(SplitMathError);
      expect((error as SplitMathError).code).toBe("shares_must_sum");
    }
  });

  it("rejects fractional or negative shares", () => {
    expect(() => splitExact(100, { a: -1, b: 101 })).toThrow(SplitMathError);
    expect(() => splitExact(100, { a: 50.5, b: 49.5 })).toThrow(SplitMathError);
  });
});

describe("splitPercent", () => {
  it("validates percent sums to 100", () => {
    try {
      splitPercent(1000, { a: 50, b: 40 });
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(SplitMathError);
      expect((error as SplitMathError).code).toBe("percent_must_sum_to_100");
    }
  });

  it("rounds and pushes the leftover to the payer", () => {
    const shares = splitPercent(1000, { a: 33.34, b: 33.33, c: 33.33 }, { payerId: "a" });
    const total = Object.values(shares).reduce((sum, value) => sum + value, 0);

    expect(total).toBe(1000);
    expect(shares.a).toBeGreaterThanOrEqual(333);
  });

  it("splits 100% to one member", () => {
    const shares = splitPercent(1234, { a: 100 });
    expect(shares).toEqual({ a: 1234 });
  });
});

describe("splitShares", () => {
  it("splits 2:1:1 of 1000 paisa correctly", () => {
    const shares = splitShares(1000, { a: 2, b: 1, c: 1 });

    expect(shares).toEqual({ a: 500, b: 250, c: 250 });
  });

  it("sums back exactly for a non-divisible ratio", () => {
    const shares = splitShares(1000, { a: 1, b: 1, c: 1 }, { payerId: "a" });
    const total = Object.values(shares).reduce((sum, value) => sum + value, 0);

    expect(total).toBe(1000);
  });

  it("rejects zero-total shares", () => {
    expect(() => splitShares(1000, { a: 0, b: 0 })).toThrow(SplitMathError);
  });
});
