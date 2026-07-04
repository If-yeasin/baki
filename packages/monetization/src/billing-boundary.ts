import type { BillingScope, MonetizationPlanKey } from "./plans";

export type BillingPlatform = "ios" | "android" | "web";
export type BillingEnvironment = "local" | "preview" | "sandbox" | "production";
export type BillingDisabledReason = "billing_disabled" | "beta_not_started" | "store_not_configured";

export type BillingProductId =
  | "baki_plus_monthly"
  | "baki_plus_yearly"
  | "khata_pro_group_monthly"
  | "khata_pro_group_yearly";

export type BillingProduct = {
  readonly id: BillingProductId;
  readonly planKey: Extract<MonetizationPlanKey, "baki_plus_individual" | "khata_pro_group">;
  readonly billingScope: Extract<BillingScope, "user" | "group">;
  readonly storeProductType: "subscription";
  readonly grantsEntitlementLocally: false;
};

export type BillingRequest = {
  readonly productId: BillingProductId;
  readonly platform: BillingPlatform;
  readonly environment: BillingEnvironment;
};

export type RestorePurchasesRequest = {
  readonly platform: BillingPlatform;
  readonly environment: BillingEnvironment;
};

export type BillingResult =
  | { readonly ok: true; readonly verificationRequired: true; readonly purchaseToken: string }
  | { readonly ok: false; readonly reason: BillingDisabledReason };

export type BillingClient = {
  readonly purchase: (request: BillingRequest) => Promise<BillingResult>;
  readonly restorePurchases: (request: RestorePurchasesRequest) => Promise<BillingResult>;
};

export type EntitlementSource =
  | "free"
  | "beta"
  | "promo"
  | "server_verified_iap"
  | "verified_invoice"
  | "client_purchase_result"
  | "manual_ui_toggle";

export const BILLING_PRODUCTS = [
  {
    id: "baki_plus_monthly",
    planKey: "baki_plus_individual",
    billingScope: "user",
    storeProductType: "subscription",
    grantsEntitlementLocally: false
  },
  {
    id: "baki_plus_yearly",
    planKey: "baki_plus_individual",
    billingScope: "user",
    storeProductType: "subscription",
    grantsEntitlementLocally: false
  },
  {
    id: "khata_pro_group_monthly",
    planKey: "khata_pro_group",
    billingScope: "group",
    storeProductType: "subscription",
    grantsEntitlementLocally: false
  },
  {
    id: "khata_pro_group_yearly",
    planKey: "khata_pro_group",
    billingScope: "group",
    storeProductType: "subscription",
    grantsEntitlementLocally: false
  }
] as const satisfies readonly BillingProduct[];

export function getBillingProduct(productId: BillingProductId): BillingProduct {
  const product = BILLING_PRODUCTS.find((candidate) => candidate.id === productId);
  if (!product) throw new Error(`unknown_billing_product:${String(productId)}`);
  return product;
}

export function createDisabledBillingClient(reason: BillingDisabledReason = "billing_disabled"): BillingClient {
  return {
    purchase: async (_request: BillingRequest) => ({ ok: false, reason }),
    restorePurchases: async (_request: RestorePurchasesRequest) => ({ ok: false, reason })
  };
}

export const DISABLED_BILLING_CLIENT = createDisabledBillingClient();

export function isStoreVerifiedEntitlementSource(source: EntitlementSource): boolean {
  return source === "server_verified_iap" || source === "verified_invoice";
}
