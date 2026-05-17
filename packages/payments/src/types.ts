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
};
