import type { MonetizationPlanKey } from "./plans";

export type PaywallMode = "none" | "free_beta" | "baki_plus" | "khata_pro" | "teams_later";

export type MonetizationFeatureId =
  | "group.create"
  | "group.join"
  | "expense.create"
  | "expense.edit"
  | "expense.delete"
  | "expense.split.custom"
  | "balance.view"
  | "settlement.record_outside_app"
  | "activity.basic"
  | "offline.basic_queue"
  | "export.basic_csv"
  | "group.archive"
  | "receipt.attach"
  | "receipt.scan"
  | "search.advanced"
  | "reports.personal"
  | "recurring_bills.manage"
  | "categories.custom"
  | "history.unlimited"
  | "report.monthly_close"
  | "export.group_pdf"
  | "export.group_excel"
  | "admin.expense_approval"
  | "roles.advanced"
  | "audit.advanced"
  | "reminders.settlement"
  | "teams.multiple_khatas"
  | "teams.member_permissions"
  | "teams.priority_support";

export type MonetizationFeature = {
  readonly key: MonetizationFeatureId;
  readonly planKey: MonetizationPlanKey;
  readonly title: string;
  readonly description: string;
  readonly paywall: PaywallMode;
};

export const FREE_CORE_FEATURE_IDS = [
  "group.create",
  "group.join",
  "expense.create",
  "expense.edit",
  "expense.delete",
  "expense.split.custom",
  "balance.view",
  "settlement.record_outside_app",
  "activity.basic",
  "offline.basic_queue"
] as const satisfies readonly MonetizationFeatureId[];

export const FUTURE_PAID_BETA_FEATURE_IDS = ["export.basic_csv", "group.archive", "receipt.attach"] as const satisfies readonly MonetizationFeatureId[];

export const PAID_FEATURE_IDS = [
  "receipt.scan",
  "search.advanced",
  "reports.personal",
  "recurring_bills.manage",
  "categories.custom",
  "history.unlimited",
  "report.monthly_close",
  "export.group_pdf",
  "export.group_excel",
  "admin.expense_approval",
  "roles.advanced",
  "audit.advanced",
  "reminders.settlement",
  "teams.multiple_khatas",
  "teams.member_permissions",
  "teams.priority_support"
] as const satisfies readonly MonetizationFeatureId[];

export const FEATURE_DEFINITIONS = [
  {
    key: "group.create",
    planKey: "free_core",
    title: "Create khatas",
    description: "Create shared groups for messes, trips, families, events, and custom ledgers.",
    paywall: "none"
  },
  {
    key: "group.join",
    planKey: "free_core",
    title: "Join khatas",
    description: "Join a shared khata by invite link or code.",
    paywall: "none"
  },
  {
    key: "expense.create",
    planKey: "free_core",
    title: "Add expenses",
    description: "Record basic shared expenses without charging for the core loop.",
    paywall: "none"
  },
  {
    key: "expense.edit",
    planKey: "free_core",
    title: "Edit expenses",
    description: "Correct ledger entries while preserving audit history.",
    paywall: "none"
  },
  {
    key: "expense.delete",
    planKey: "free_core",
    title: "Delete expenses",
    description: "Soft-delete mistaken ledger entries safely.",
    paywall: "none"
  },
  {
    key: "expense.split.custom",
    planKey: "free_core",
    title: "Custom split methods",
    description: "Split by equal, exact, percent, or shares.",
    paywall: "none"
  },
  {
    key: "balance.view",
    planKey: "free_core",
    title: "View balances",
    description: "See who owes whom inside each khata.",
    paywall: "none"
  },
  {
    key: "settlement.record_outside_app",
    planKey: "free_core",
    title: "Record outside-app settlements",
    description: "Record cash, bKash, Nagad, or other settlements completed outside Baki.",
    paywall: "none"
  },
  {
    key: "activity.basic",
    planKey: "free_core",
    title: "Basic activity history",
    description: "Show recent ledger activity so group members can trust the khata.",
    paywall: "none"
  },
  {
    key: "offline.basic_queue",
    planKey: "free_core",
    title: "Basic offline queue",
    description: "Queue core ledger writes and replay when connectivity returns.",
    paywall: "none"
  },
  {
    key: "export.basic_csv",
    planKey: "baki_plus_individual",
    title: "Basic CSV export",
    description: "Current beta export stays available while future pricing is tested.",
    paywall: "free_beta"
  },
  {
    key: "group.archive",
    planKey: "khata_pro_group",
    title: "Group archive",
    description: "Current beta archive stays available while future group plans are tested.",
    paywall: "free_beta"
  },
  {
    key: "receipt.attach",
    planKey: "khata_pro_group",
    title: "Receipt attachment storage",
    description: "Attach receipt proof when safe storage policies and offline retry are ready.",
    paywall: "free_beta"
  },
  {
    key: "receipt.scan",
    planKey: "baki_plus_individual",
    title: "Receipt scan",
    description: "Extract receipt totals and items for faster personal splits.",
    paywall: "baki_plus"
  },
  {
    key: "search.advanced",
    planKey: "baki_plus_individual",
    title: "Advanced search",
    description: "Search across older expenses, categories, members, and notes.",
    paywall: "baki_plus"
  },
  {
    key: "reports.personal",
    planKey: "baki_plus_individual",
    title: "Personal reports",
    description: "Show personal spending trends across khatas.",
    paywall: "baki_plus"
  },
  {
    key: "recurring_bills.manage",
    planKey: "baki_plus_individual",
    title: "Recurring bills",
    description: "Prepare repeating rent, utility, mess, or family expenses.",
    paywall: "baki_plus"
  },
  {
    key: "categories.custom",
    planKey: "baki_plus_individual",
    title: "Custom categories",
    description: "Create extra categories beyond the core Baki set.",
    paywall: "baki_plus"
  },
  {
    key: "history.unlimited",
    planKey: "baki_plus_individual",
    title: "Unlimited history",
    description: "Keep deeper searchable history and archives for power users.",
    paywall: "baki_plus"
  },
  {
    key: "report.monthly_close",
    planKey: "khata_pro_group",
    title: "Monthly khata close",
    description: "Close a month or trip with totals, balances, completed settlements, and pending amounts.",
    paywall: "khata_pro"
  },
  {
    key: "export.group_pdf",
    planKey: "khata_pro_group",
    title: "Group PDF report",
    description: "Export a polished monthly হিসাব report for sharing.",
    paywall: "khata_pro"
  },
  {
    key: "export.group_excel",
    planKey: "khata_pro_group",
    title: "Group Excel export",
    description: "Export structured group rows for admins and accounting.",
    paywall: "khata_pro"
  },
  {
    key: "admin.expense_approval",
    planKey: "khata_pro_group",
    title: "Expense approval",
    description: "Let admins review sensitive group expenses before monthly close.",
    paywall: "khata_pro"
  },
  {
    key: "roles.advanced",
    planKey: "khata_pro_group",
    title: "Advanced roles",
    description: "Support manager-style group roles for messes and organized groups.",
    paywall: "khata_pro"
  },
  {
    key: "audit.advanced",
    planKey: "khata_pro_group",
    title: "Advanced audit history",
    description: "Expose deeper edit history and accountability for group admins.",
    paywall: "khata_pro"
  },
  {
    key: "reminders.settlement",
    planKey: "khata_pro_group",
    title: "Settlement reminders",
    description: "Send respectful opt-in reminders for pending balances.",
    paywall: "khata_pro"
  },
  {
    key: "teams.multiple_khatas",
    planKey: "teams_later",
    title: "Multiple khatas under one workspace",
    description: "Future small-team workspace organization.",
    paywall: "teams_later"
  },
  {
    key: "teams.member_permissions",
    planKey: "teams_later",
    title: "Team member permissions",
    description: "Future permission controls for small teams and businesses.",
    paywall: "teams_later"
  },
  {
    key: "teams.priority_support",
    planKey: "teams_later",
    title: "Priority support",
    description: "Future support tier for business customers.",
    paywall: "teams_later"
  }
] as const satisfies readonly MonetizationFeature[];

const featureKeys = new Set<MonetizationFeatureId>(FEATURE_DEFINITIONS.map((feature) => feature.key));
const freeCoreFeatures = new Set<MonetizationFeatureId>(FREE_CORE_FEATURE_IDS);
const paidFeatures = new Set<MonetizationFeatureId>(PAID_FEATURE_IDS);

export const monetizationFeatureSchema = {
  safeParse(value: unknown): { success: true; data: MonetizationFeatureId } | { success: false } {
    return typeof value === "string" && featureKeys.has(value as MonetizationFeatureId)
      ? { success: true, data: value as MonetizationFeatureId }
      : { success: false };
  }
};

export function getFeatureDefinition(featureId: MonetizationFeatureId): MonetizationFeature {
  const feature = FEATURE_DEFINITIONS.find((candidate) => candidate.key === featureId);
  if (!feature) throw new Error(`unknown_monetization_feature:${String(featureId)}`);
  return feature;
}

export function isFreeCoreFeature(featureId: MonetizationFeatureId): boolean {
  return freeCoreFeatures.has(featureId);
}

export function isPaidFeature(featureId: MonetizationFeatureId): boolean {
  return paidFeatures.has(featureId);
}
