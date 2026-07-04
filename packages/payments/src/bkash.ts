import { normalizeBdPhone, paisaToTaka } from "./format";
import { parseMoneyTransferIntent } from "./schema";
import type { MoneyTransferIntent, PaymentLinkPlan } from "./types";

export function createBkashSendMoneyPlan(intent: MoneyTransferIntent): PaymentLinkPlan {
  const parsed = parseMoneyTransferIntent(intent);
  const number = normalizeBdPhone(parsed.recipientNumber);
  const amount = paisaToTaka(parsed.amountPaisa);
  const params = new URLSearchParams({
    amount,
    number
  });

  if (parsed.note) {
    params.set("reference", parsed.note.slice(0, 50));
  }

  return {
    fallbackLabel: number,
    provider: "bkash",
    urls: [
      `bkashopen://send?${params.toString()}`,
      `https://www.bkash.com/send-money?${params.toString()}`
    ]
  };
}
