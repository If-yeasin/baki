import { describe, expect, it } from "vitest";

import {
  ANALYTICS_EVENTS,
  type AnalyticsEventName,
  analyticsEventNameSchema,
  assertSafeAnalyticsPayload,
  createAnalyticsEvent,
  redactAnalyticsPayload
} from "./index";

describe("analytics event catalog", () => {
  it("accepts only known analytics event names", () => {
    for (const eventName of ANALYTICS_EVENTS) {
      expect(analyticsEventNameSchema.safeParse(eventName).success).toBe(true);
    }

    expect(analyticsEventNameSchema.safeParse("billing.unknown").success).toBe(false);
  });

  it("creates typed events with redacted payload values", () => {
    const event = createAnalyticsEvent("monetization.feature_gate_viewed", {
      featureId: "receipt.scan",
      phone: "+8801700123456",
      bkashNumber: "01700123456",
      external_ref: "TXN-123",
      note: "No sensitive data here"
    });

    expect(event.name).toBe("monetization.feature_gate_viewed");
    expect(event.payload).toMatchObject({
      featureId: "receipt.scan",
      phone: "[redacted]",
      bkashNumber: "[redacted]",
      external_ref: "[redacted]",
      note: "No sensitive data here"
    });
  });

  it("rejects unknown event names before tracking", () => {
    expect(() =>
      createAnalyticsEvent("monetization.not_real" as AnalyticsEventName, {})
    ).toThrow(/unknown_analytics_event/);
  });

  it("redacts sensitive nested analytics payloads", () => {
    expect(
      redactAnalyticsPayload({
        nested: {
          token: "secret-token",
          values: ["call +880****3456", { nagadNumber: "01700123456" }]
        }
      })
    ).toEqual({
      nested: {
        token: "[redacted]",
        values: ["call [redacted-phone]", { nagadNumber: "[redacted]" }]
      }
    });
  });

  it("redacts payment reference aliases and spaced Bangladeshi phone numbers", () => {
    expect(
      redactAnalyticsPayload({
        reference: "bkash-ref-123",
        trxId: "TXN-123",
        transactionId: "NAGAD-456",
        orderId: "ORDER-789",
        message: "payer +880 1700 123456 and backup 01700-123456"
      })
    ).toEqual({
      reference: "[redacted]",
      trxId: "[redacted]",
      transactionId: "[redacted]",
      orderId: "[redacted]",
      message: "payer [redacted-phone] and backup [redacted-phone]"
    });
  });

  it("redacts embedded payment reference strings under neutral keys", () => {
    expect(
      redactAnalyticsPayload({
        message: "external_ref=BKASH-123 trxId:TXN-456 orderId ORDER-789",
        status: "safe"
      })
    ).toEqual({
      message: "[redacted-reference] [redacted-reference] [redacted-reference]",
      status: "safe"
    });
  });

  it("fails closed for sensitive payloads when explicitly asserted", () => {
    expect(() =>
      assertSafeAnalyticsPayload({ phone: "+880****3456" })
    ).toThrow(/unsafe_analytics_payload/);

    expect(() =>
      assertSafeAnalyticsPayload({ transactionId: "TXN-123" })
    ).toThrow(/unsafe_analytics_payload:transactionId/);
  });
});
