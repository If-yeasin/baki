export type SettlementProvider = "bkash" | "nagad" | "cash" | "other";

export type MoneyTransferIntent = {
  amountPaisa: number;
  note?: string;
  recipientNumber: string;
};

export type PaymentLinkPlan = {
  fallbackLabel: string;
  provider: Extract<SettlementProvider, "bkash" | "nagad">;
  urls: string[];
  /**
   * Optional USSD payload for providers (currently Nagad) where the most
   * reliable settlement affordance is a dial code copied to clipboard.
   * The payments package returns raw command strings only — the UI layer
   * owns localization of any explanatory text shown alongside.
   */
  ussd?: {
    dial: string;
    preview: string;
  };
};
