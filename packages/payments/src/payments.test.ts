import { describe, expect, it } from "vitest";

import { createBkashSendMoneyPlan, maskMfsNumber, paisaToTaka } from "./index";

describe("payments helpers", () => {
  it("formats paisa into taka for MFS URLs", () => {
    expect(paisaToTaka(45000)).toBe("450");
    expect(paisaToTaka(45050)).toBe("450.50");
  });

  it("builds a bKash fallback plan without exposing provider logic to screens", () => {
    const plan = createBkashSendMoneyPlan({
      amountPaisa: 45000,
      note: "Sajek trip",
      recipientNumber: "01700123456"
    });

    expect(plan.provider).toBe("bkash");
    expect(plan.urls[0]).toContain("amount=450");
    expect(plan.urls[1]).toContain("bkashopen://send");
  });

  it("masks MFS numbers for logs", () => {
    expect(maskMfsNumber("+8801700123456")).toBe("+880170****456");
  });
});
