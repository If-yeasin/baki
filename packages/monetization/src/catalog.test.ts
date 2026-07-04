import { describe, expect, it } from "vitest";

import {
  FEATURE_DEFINITIONS,
  FREE_CORE_FEATURE_IDS,
  MONETIZATION_PLANS,
  PAID_FEATURE_IDS,
  getFeatureDefinition,
  getPlanDefinition,
  isFreeCoreFeature,
  isPaidFeature,
  monetizationFeatureSchema,
  monetizationPlanSchema
} from "./index";

describe("monetization catalog", () => {
  it("keeps every feature attached to a known plan", () => {
    const planKeys = new Set(MONETIZATION_PLANS.map((plan) => plan.key));

    for (const feature of FEATURE_DEFINITIONS) {
      expect(planKeys.has(feature.planKey)).toBe(true);
      expect(monetizationFeatureSchema.safeParse(feature.key).success).toBe(true);
      expect(monetizationPlanSchema.safeParse(feature.planKey).success).toBe(true);
    }
  });

  it("keeps the viral core ledger free", () => {
    expect(FREE_CORE_FEATURE_IDS).toEqual(
      expect.arrayContaining([
        "group.create",
        "group.join",
        "expense.create",
        "expense.split.custom",
        "balance.view",
        "settlement.record_outside_app",
        "activity.basic",
        "offline.basic_queue"
      ])
    );

    for (const featureId of FREE_CORE_FEATURE_IDS) {
      expect(isFreeCoreFeature(featureId)).toBe(true);
      expect(getFeatureDefinition(featureId).planKey).toBe("free_core");
    }
  });

  it("uses stable paid feature ids for Baki Plus and Khata Pro", () => {
    expect(PAID_FEATURE_IDS).toEqual(
      expect.arrayContaining([
        "receipt.scan",
        "search.advanced",
        "reports.personal",
        "recurring_bills.manage",
        "categories.custom",
        "history.unlimited",
        "report.monthly_close",
        "export.group_pdf",
        "admin.expense_approval",
        "roles.advanced",
        "audit.advanced",
        "reminders.settlement"
      ])
    );

    for (const featureId of PAID_FEATURE_IDS) {
      expect(isPaidFeature(featureId)).toBe(true);
      expect(getFeatureDefinition(featureId).paywall).not.toBe("none");
    }
  });

  it("does not catalog settlement fees, wallet custody, or payment processing", () => {
    const allSearchText = [
      ...FEATURE_DEFINITIONS.flatMap((feature) => [feature.key, feature.title, feature.description]),
      ...MONETIZATION_PLANS.flatMap((plan) => [plan.key, plan.title, plan.description])
    ]
      .join(" ")
      .toLowerCase();

    expect(allSearchText).not.toContain("settlement fee");
    expect(allSearchText).not.toContain("wallet");
    expect(allSearchText).not.toContain("custody");
    expect(allSearchText).not.toContain("process payments");
    expect(allSearchText).not.toContain("payment processing");
  });

  it("returns plan definitions by key", () => {
    expect(getPlanDefinition("baki_plus_individual").title).toBe("Baki Plus");
    expect(getPlanDefinition("khata_pro_group").billingScope).toBe("group");
  });
});
