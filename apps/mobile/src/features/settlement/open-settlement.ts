import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";

import { buildSettlementPlan, type DeepLinkSettlementProvider } from "@baki/payments";

import { Sentry } from "@/lib/sentry";

export type OpenSettlementInput = {
  amountPaisa: number;
  note?: string;
  provider: DeepLinkSettlementProvider;
  recipientNumber: string;
};

export type OpenSettlementResult =
  | { kind: "opened"; provider: DeepLinkSettlementProvider }
  | { kind: "copied"; preview: string }
  | { kind: "fallback"; copied: string };

/**
 * Try to deep-link into the MFS app; if no URL handler responds, copy the
 * fallback (USSD dial or phone number) to the clipboard so the user can
 * paste it into their dialer/app manually. The screen surfaces a localized
 * toast based on the returned kind.
 */
export async function openSettlement(input: OpenSettlementInput): Promise<OpenSettlementResult> {
  const plan = buildSettlementPlan(input);

  for (const url of plan.urls) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return { kind: "opened", provider: plan.provider };
      }
    } catch (error) {
      // Log and try the next candidate URL.
      Sentry.captureException(error, {
        tags: { feature: "settlement.deep_link", provider: plan.provider }
      });
    }
  }

  if (plan.ussd) {
    await Clipboard.setStringAsync(plan.ussd.dial);
    return { kind: "copied", preview: plan.ussd.preview };
  }

  await Clipboard.setStringAsync(plan.fallbackLabel);
  return { kind: "fallback", copied: plan.fallbackLabel };
}
