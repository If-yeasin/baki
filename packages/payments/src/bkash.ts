import { normalizeBdPhone, paisaToTaka } from "./format";
import type { MoneyTransferIntent, PaymentLinkPlan } from "./types";

export function createBkashSendMoneyPlan(intent: MoneyTransferIntent): PaymentLinkPlan {
  const number = normalizeBdPhone(intent.recipientNumber);
  const amount = paisaToTaka(intent.amountPaisa);
  const params = new URLSearchParams({
    amount,
    number
  });

  if (intent.note) {
    params.set("reference", intent.note.slice(0, 50));
  }

  return {
    fallbackLabel: number,
    provider: "bkash",
    urls: [
      `https://www.bkash.com/send-money?${params.toString()}`,
      `bkashopen://send?${params.toString()}`
    ]
  };
}
