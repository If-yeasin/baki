import { describe, expect, it } from "vitest";

import {
  BILLING_PRODUCTS,
  DISABLED_BILLING_CLIENT,
  type BillingClient,
  createDisabledBillingClient,
  getBillingProduct,
  isStoreVerifiedEntitlementSource
} from "./index";

describe("billing boundary", () => {
  it("keeps billing disabled by default", async () => {
    const result = await DISABLED_BILLING_CLIENT.purchase({
      productId: "baki_plus_monthly",
      platform: "ios",
      environment: "sandbox"
    });

    expect(result).toEqual({
      ok: false,
      reason: "billing_disabled"
    });
  });

  it("allows dependency injection without enabling purchases", async () => {
    const client: BillingClient = createDisabledBillingClient("beta_not_started");

    await expect(
      client.restorePurchases({ platform: "android", environment: "sandbox" })
    ).resolves.toEqual({ ok: false, reason: "beta_not_started" });
  });

  it("maps product ids to catalog plans without granting entitlements locally", () => {
    expect(getBillingProduct("baki_plus_monthly")).toMatchObject({
      planKey: "baki_plus_individual",
      billingScope: "user",
      storeProductType: "subscription"
    });

    expect(getBillingProduct("khata_pro_group_monthly")).toMatchObject({
      planKey: "khata_pro_group",
      billingScope: "group"
    });

    expect(BILLING_PRODUCTS.every((product) => product.grantsEntitlementLocally === false)).toBe(true);
  });

  it("requires server/store verification before an entitlement source can be trusted", () => {
    expect(isStoreVerifiedEntitlementSource("server_verified_iap")).toBe(true);
    expect(isStoreVerifiedEntitlementSource("verified_invoice")).toBe(true);
    expect(isStoreVerifiedEntitlementSource("client_purchase_result")).toBe(false);
    expect(isStoreVerifiedEntitlementSource("manual_ui_toggle")).toBe(false);
  });
});
