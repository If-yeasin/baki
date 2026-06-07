import { z } from "zod";

import { PaymentInputError } from "./errors";
import { isValidBdPhone } from "./format";

// BDT 50,000 per-settlement cap aligns with MFS daily send-money limits and Baki's non-custodial position; raising it requires policy review.
export const MAX_SETTLEMENT_PAISA = 5_000_000;

export const settlementProviderSchema = z.union([
  z.literal("bkash"),
  z.literal("nagad"),
  z.literal("cash"),
  z.literal("other")
]);

export const moneyTransferIntentSchema = z.object({
  amountPaisa: z
    .number()
    .int("amount_paisa_must_be_integer")
    .positive("amount_paisa_must_be_positive")
    .max(MAX_SETTLEMENT_PAISA, "amount_paisa_too_large"),
  recipientNumber: z
    .string()
    .min(1, "invalid_bd_phone")
    .refine(isValidBdPhone, { message: "invalid_bd_phone" }),
  note: z.string().max(50, "note_too_long").optional()
});

export type MoneyTransferIntentInput = z.input<typeof moneyTransferIntentSchema>;
export type MoneyTransferIntentParsed = z.output<typeof moneyTransferIntentSchema>;

/**
 * Parse a money-transfer intent or throw a typed PaymentInputError. The
 * Zod error code (e.g. `invalid_bd_phone`, `note_too_long`) is preserved as
 * the error `code` so callers can branch / localize without reading
 * English messages.
 */
export function parseMoneyTransferIntent(input: unknown): MoneyTransferIntentParsed {
  const result = moneyTransferIntentSchema.safeParse(input);
  if (result.success) {
    return result.data;
  }

  const firstIssue = result.error.issues[0];
  const code = firstIssue?.message ?? "invalid_money_transfer_intent";
  throw new PaymentInputError(code);
}
