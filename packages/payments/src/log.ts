import { maskMfsNumber } from "./format";
import type { MoneyTransferIntent, SettlementProvider } from "./types";

export type SafeSettlementLogFields = {
  provider: SettlementProvider;
  amountPaisa: number;
  notePresent: boolean;
  recipientMasked: string;
};

/**
 * Build a structured, privacy-safe object suitable for Sentry breadcrumbs
 * and console logs. Never includes the raw recipient number or the note
 * contents — both can be PII or personal context the user did not
 * consent to having logged.
 */
export function safeSettlementLogFields(
  intent: MoneyTransferIntent,
  provider: SettlementProvider
): SafeSettlementLogFields {
  return {
    provider,
    amountPaisa: intent.amountPaisa,
    notePresent: typeof intent.note === "string" && intent.note.length > 0,
    recipientMasked: maskMfsNumber(intent.recipientNumber)
  };
}
