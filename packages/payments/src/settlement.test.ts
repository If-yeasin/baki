import { describe, expect, it } from "vitest";

import {
  buildSettlementPlan,
  createBkashSendMoneyPlan,
  isValidBdPhone,
  MAX_SETTLEMENT_PAISA,
  parseMoneyTransferIntent,
  PaymentInputError,
  safeSettlementLogFields
} from "./index";

describe("settlement validation", () => {
  it("keeps the valid bKash plan working end-to-end", () => {
    const plan = createBkashSendMoneyPlan({
      amountPaisa: 45000,
      note: "Sajek trip",
      recipientNumber: "01700123456"
    });

    expect(plan.provider).toBe("bkash");
    expect(plan.urls[0]).toContain("amount=450");
    expect(plan.urls[1]).toContain("bkashopen://send");
    expect(plan.fallbackLabel).toBe("+8801700123456");
  });

  it("rejects invalid amounts with PaymentInputError", () => {
    for (const bad of [0, -1, 12.5]) {
      expect(() =>
        createBkashSendMoneyPlan({
          amountPaisa: bad,
          recipientNumber: "01700123456"
        })
      ).toThrow(PaymentInputError);
    }
  });

  it("rejects malformed BD phone numbers with code invalid_bd_phone", () => {
    try {
      createBkashSendMoneyPlan({
        amountPaisa: 45000,
        recipientNumber: "+880123"
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(PaymentInputError);
      expect((err as PaymentInputError).code).toBe("invalid_bd_phone");
    }
  });

  it("rejects notes longer than 50 chars", () => {
    expect(() =>
      createBkashSendMoneyPlan({
        amountPaisa: 45000,
        note: "x".repeat(51),
        recipientNumber: "01700123456"
      })
    ).toThrow(PaymentInputError);
  });

  it("accepts amounts exactly at the BDT 50,000 per-settlement cap", () => {
    expect(MAX_SETTLEMENT_PAISA).toBe(5_000_000);
    const parsed = parseMoneyTransferIntent({
      amountPaisa: 5_000_000,
      recipientNumber: "+8801712345678"
    });
    expect(parsed.amountPaisa).toBe(5_000_000);
  });

  it("rejects amounts one paisa over the cap with code amount_paisa_too_large", () => {
    try {
      parseMoneyTransferIntent({
        amountPaisa: 5_000_001,
        recipientNumber: "+8801712345678"
      });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(PaymentInputError);
      expect((err as PaymentInputError).code).toBe("amount_paisa_too_large");
    }
  });
});

describe("safeSettlementLogFields", () => {
  it("masks the recipient number and never leaks the note text", () => {
    const fields = safeSettlementLogFields(
      {
        amountPaisa: 45000,
        note: "secret iftar split",
        recipientNumber: "+8801700123456"
      },
      "bkash"
    );

    expect(fields).toEqual({
      provider: "bkash",
      amountPaisa: 45000,
      notePresent: true,
      recipientMasked: "+880170****456"
    });
    expect(JSON.stringify(fields)).not.toContain("secret iftar split");
    expect(JSON.stringify(fields)).not.toContain("1700123456");
  });

  it("sets notePresent=false when the note is missing or empty", () => {
    expect(
      safeSettlementLogFields({ amountPaisa: 1000, recipientNumber: "+8801700123456" }, "cash")
        .notePresent
    ).toBe(false);
  });
});

describe("buildSettlementPlan dispatcher", () => {
  it("routes to Nagad and returns a USSD payload with *167#", () => {
    const plan = buildSettlementPlan({
      provider: "nagad",
      amountPaisa: 45000,
      recipientNumber: "01800123456"
    });

    expect(plan.provider).toBe("nagad");
    expect(plan.ussd?.dial).toBe("*167#");
    // Nagad has no documented P2P deep-link scheme — see nagad.ts comment.
    // The plan ships USSD-only; urls is intentionally empty.
    expect(plan.urls).toEqual([]);
  });

  it("routes to bKash", () => {
    const plan = buildSettlementPlan({
      provider: "bkash",
      amountPaisa: 45000,
      recipientNumber: "01700123456"
    });
    expect(plan.provider).toBe("bkash");
    expect(plan.ussd).toBeUndefined();
  });
});

describe("isValidBdPhone", () => {
  it("accepts well-formed BD mobile numbers", () => {
    expect(isValidBdPhone("01700123456")).toBe(true);
    expect(isValidBdPhone("+8801912345678")).toBe(true);
  });

  it("rejects malformed input without throwing", () => {
    expect(isValidBdPhone("+880123")).toBe(false);
    expect(isValidBdPhone("12345")).toBe(false);
    expect(isValidBdPhone("")).toBe(false);
  });
});
