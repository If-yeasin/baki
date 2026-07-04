import { describe, expect, it, vi } from "vitest";

vi.mock("./expo-runtime", () => ({
  isExpoGo: true
}));

import { redactSensitiveSentryText, redactSentryPayload } from "./sentry";

describe("sentry redaction", () => {
  it("redacts sensitive strings before capture", () => {
    expect(
      redactSensitiveSentryText(
        "phone +8801712345678 token=secret Bearer eyJabc.def.ghi external_ref=bkash-123"
      )
    ).toBe(
      "phone [redacted-phone] token=[redacted] [redacted-jwt] external_ref=[redacted]"
    );
  });

  it("redacts sensitive object keys recursively", () => {
    expect(
      redactSentryPayload({
        contexts: {
          profile: {
            bkashNumber: "+8801712345678",
            displayName: "Rini"
          }
        },
        message: "failed for ExponentPushToken[abc]",
        tags: {
          feature: "notifications.register"
        }
      })
    ).toEqual({
      contexts: {
        profile: {
          bkashNumber: "[redacted]",
          displayName: "Rini"
        }
      },
      message: "failed for ExponentPushToken[redacted]",
      tags: {
        feature: "notifications.register"
      }
    });
  });
});
