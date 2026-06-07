import { normalizeBdPhone, paisaToTaka } from "./format";
import { parseMoneyTransferIntent } from "./schema";
import type { MoneyTransferIntent, PaymentLinkPlan } from "./types";

const NAGAD_USSD_DIAL = "*167#";

// Nagad does not publish a P2P "Send Money" URL scheme for third-party apps;
// only the merchant payment gateway (server-to-server) is officially documented.
// We deliberately ship an empty `urls` list and rely on USSD copy-to-clipboard
// per docs/BANGLADESH_CONTEXT.md. Re-enabling deep links requires verification
// with Nagad and a feature flag.
export function createNagadSendMoneyPlan(intent: MoneyTransferIntent): PaymentLinkPlan {
  const parsed = parseMoneyTransferIntent(intent);
  const number = normalizeBdPhone(parsed.recipientNumber);
  const amount = paisaToTaka(parsed.amountPaisa);

  return {
    fallbackLabel: `${NAGAD_USSD_DIAL} ${number}`,
    provider: "nagad",
    urls: [],
    ussd: {
      dial: NAGAD_USSD_DIAL,
      // Raw, non-localized preview. The UI layer wraps this in localized
      // copy (e.g. `settle.via.nagad.ussd_preview`).
      preview: `${NAGAD_USSD_DIAL} ${number} ${amount}`
    }
  };
}
