import { createBkashSendMoneyPlan } from "./bkash";
import { PaymentInputError } from "./errors";
import { createNagadSendMoneyPlan } from "./nagad";
import type { MoneyTransferIntent, PaymentLinkPlan } from "./types";

export { createBkashSendMoneyPlan } from "./bkash";
export { PaymentInputError } from "./errors";
export { isValidBdPhone, maskMfsNumber, normalizeBdPhone, paisaToTaka } from "./format";
export { safeSettlementLogFields } from "./log";
export type { SafeSettlementLogFields } from "./log";
export { createNagadSendMoneyPlan } from "./nagad";
export {
  MAX_SETTLEMENT_PAISA,
  moneyTransferIntentSchema,
  parseMoneyTransferIntent,
  settlementProviderSchema
} from "./schema";
export type { MoneyTransferIntentInput, MoneyTransferIntentParsed } from "./schema";
export type { MoneyTransferIntent, PaymentLinkPlan, SettlementProvider } from "./types";

export type DeepLinkSettlementProvider = "bkash" | "nagad";

export type SettlementPlanInput = MoneyTransferIntent & {
  provider: DeepLinkSettlementProvider;
};

/**
 * Top-level dispatcher for building MFS settlement plans. Centralizes
 * provider routing so screens don't import `bkash.ts` / `nagad.ts`
 * directly. Validation lives in each provider's plan builder via the
 * shared Zod schema; this dispatcher rejects unknown providers explicitly.
 */
export function buildSettlementPlan(input: SettlementPlanInput): PaymentLinkPlan {
  const { provider, ...intent } = input;
  switch (provider) {
    case "bkash":
      return createBkashSendMoneyPlan(intent);
    case "nagad":
      return createNagadSendMoneyPlan(intent);
    default: {
      // Exhaustiveness guard — if a new deep-link provider is added to
      // DeepLinkSettlementProvider, the compiler will force a case here.
      const exhaustive: never = provider;
      throw new PaymentInputError("unsupported_provider", `unsupported_provider:${String(exhaustive)}`);
    }
  }
}
