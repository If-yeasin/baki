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

  it("redacts payment reference aliases and spaced Bangladesh phone numbers", () => {
    expect(
      redactSensitiveSentryText(
        "failed url=bkash://pay?reference=iftar-2026&trxId=TXN-123&transactionId=NAGAD-456&orderId=ORDER-789 payer +880 1700 123456 backup 01700-123456"
      )
    ).toBe(
      "failed url=bkash://pay?reference=[redacted]&trxId=[redacted]&transactionId=[redacted]&orderId=[redacted] payer [redacted-phone] backup [redacted-phone]"
    );
  });

  it("redacts sensitive object keys recursively", () => {
    expect(
      redactSentryPayload({
        contexts: {
          profile: {
            bkashNumber: "+880****5678",
            displayName: "Rini",
            orderId: "ORDER-789",
            transactionId: "NAGAD-456"
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
          displayName: "Rini",
          orderId: "[redacted]",
          transactionId: "[redacted]"
        }
      },
      message: "failed for ExponentPushToken[redacted]",
      tags: {
        feature: "notifications.register"
      }
    });
  });
});
