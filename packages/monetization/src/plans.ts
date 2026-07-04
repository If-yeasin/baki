export type MonetizationPlanKey =
  | "free_core"
  | "baki_plus_individual"
  | "khata_pro_group"
  | "teams_later";

export type BillingScope = "none" | "user" | "group" | "workspace";

export type MonetizationPlan = {
  readonly key: MonetizationPlanKey;
  readonly title: string;
  readonly description: string;
  readonly billingScope: BillingScope;
  readonly launchStage: "available" | "future_paid" | "later";
};

export const MONETIZATION_PLANS = [
  {
    key: "free_core",
    title: "Baki Free",
    description: "The viral shared khata loop: groups, expenses, balances, settlement recording, activity, and basic offline use.",
    billingScope: "none",
    launchStage: "available"
  },
  {
    key: "baki_plus_individual",
    title: "Baki Plus",
    description: "Power-user tools for search, reports, receipt intelligence, custom categories, recurring bills, and deeper personal history.",
    billingScope: "user",
    launchStage: "future_paid"
  },
  {
    key: "khata_pro_group",
    title: "Khata Pro",
    description: "Organized-group tools for monthly close, reports, admin controls, reminders, audit history, and shared receipt storage.",
    billingScope: "group",
    launchStage: "future_paid"
  },
  {
    key: "teams_later",
    title: "Baki Teams",
    description: "Future small-team and business workspace layer for multiple khatas, permissions, exports, and support.",
    billingScope: "workspace",
    launchStage: "later"
  }
] as const satisfies readonly MonetizationPlan[];

const planKeys = new Set<MonetizationPlanKey>(MONETIZATION_PLANS.map((plan) => plan.key));

export const monetizationPlanSchema = {
  safeParse(value: unknown): { success: true; data: MonetizationPlanKey } | { success: false } {
    return typeof value === "string" && planKeys.has(value as MonetizationPlanKey)
      ? { success: true, data: value as MonetizationPlanKey }
      : { success: false };
  }
};

export function getPlanDefinition(planKey: MonetizationPlanKey): MonetizationPlan {
  const plan = MONETIZATION_PLANS.find((candidate) => candidate.key === planKey);
  if (!plan) throw new Error(`unknown_monetization_plan:${String(planKey)}`);
  return plan;
}
