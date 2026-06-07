import { describe, expect, it } from "vitest";

import { GROUP_TEMPLATES, isGroupTemplate, UNKNOWN_DISPLAY_NAME } from "./types";

describe("isGroupTemplate", () => {
  it("accepts every known template", () => {
    for (const template of GROUP_TEMPLATES) {
      expect(isGroupTemplate(template)).toBe(true);
    }
  });

  it("rejects unknown values", () => {
    expect(isGroupTemplate("garbage")).toBe(false);
    expect(isGroupTemplate("")).toBe(false);
  });
});

describe("UNKNOWN_DISPLAY_NAME", () => {
  it("is a non-empty Bengali fallback", () => {
    expect(UNKNOWN_DISPLAY_NAME.length).toBeGreaterThan(0);
    // The constant intentionally lives outside i18n so it never serializes to "".
    expect(UNKNOWN_DISPLAY_NAME).not.toBe("");
  });
});
