import { describe, expect, it } from "vitest";

import bn from "./bn.json";
import en from "./en.json";

describe("translation catalogs", () => {
  it("keeps Bengali and English keys in parity", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(bn).sort());
  });
});
