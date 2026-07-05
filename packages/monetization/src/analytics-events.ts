export const ANALYTICS_EVENTS = [
  "monetization.plan_screen_viewed",
  "monetization.feature_gate_viewed",
  "monetization.feature_gate_cta_pressed",
  "export.started",
  "export.succeeded",
  "export.failed",
  "report.viewed",
  "report.export_started",
  "report.export_succeeded",
  "receipt_scan.cta_pressed",
  "billing.purchase_started",
  "billing.purchase_succeeded",
  "billing.purchase_failed"
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];
export type AnalyticsPrimitive = string | number | boolean | null;
export type AnalyticsPayload = {
  readonly [key: string]: AnalyticsPrimitive | AnalyticsPayload | readonly (AnalyticsPrimitive | AnalyticsPayload)[];
};

const analyticsEventNames = new Set<string>(ANALYTICS_EVENTS);
const sensitiveKeyPattern =
  /(phone|bkash|nagad|mfs|token|otp|external_?ref|payment_?ref|receipt|reference|trx_?id|transaction_?id|order_?id)/i;
const phonePattern =
  /\+?8801\d{9}\b|\b01\d{9}\b|\+?880[\s-]*1(?:[\s-]*\d){9}\b|\b01(?:[\s-]*\d){9}\b|\+?880\*+\d{4}\b|\b01\*+\d{4}\b/g;
const jwtPattern = /\b(?:Bearer\s+)?eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

export const analyticsEventNameSchema = {
  safeParse(value: unknown): { success: true; data: AnalyticsEventName } | { success: false } {
    return typeof value === "string" && analyticsEventNames.has(value)
      ? { success: true, data: value as AnalyticsEventName }
      : { success: false };
  }
};

export type AnalyticsEvent = {
  readonly name: AnalyticsEventName;
  readonly payload: AnalyticsPayload;
  readonly createdAt: string;
};

export function createAnalyticsEvent(
  name: AnalyticsEventName,
  payload: AnalyticsPayload = {},
  createdAt = new Date().toISOString()
): AnalyticsEvent {
  const parsed = analyticsEventNameSchema.safeParse(name);
  if (!parsed.success) throw new Error(`unknown_analytics_event:${String(name)}`);

  return {
    createdAt,
    name: parsed.data,
    payload: redactAnalyticsPayload(payload)
  };
}

export function assertSafeAnalyticsPayload(payload: AnalyticsPayload): void {
  const unsafePath = findUnsafePayloadPath(payload);
  if (unsafePath) throw new Error(`unsafe_analytics_payload:${unsafePath}`);
}

export function redactAnalyticsPayload<T extends AnalyticsPayload>(payload: T): T {
  return redactUnknown(payload) as T;
}

function redactUnknown(value: unknown, key = "", depth = 0): unknown {
  if (depth > 8) return "[redacted-depth]";
  if (sensitiveKeyPattern.test(key)) return "[redacted]";

  if (typeof value === "string") {
    return value.replace(phonePattern, "[redacted-phone]").replace(jwtPattern, "[redacted-jwt]");
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactUnknown(entry, key, depth + 1));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        redactUnknown(entryValue, entryKey, depth + 1)
      ])
    );
  }

  return value;
}

function findUnsafePayloadPath(value: unknown, key = "payload", depth = 0): string | null {
  if (depth > 8) return null;

  if (sensitiveKeyPattern.test(key)) return key;
  if (typeof value === "string" && (phonePattern.test(value) || jwtPattern.test(value))) {
    phonePattern.lastIndex = 0;
    jwtPattern.lastIndex = 0;
    return key;
  }

  phonePattern.lastIndex = 0;
  jwtPattern.lastIndex = 0;

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const unsafe = findUnsafePayloadPath(value[index], `${key}[${index}]`, depth + 1);
      if (unsafe) return unsafe;
    }
  }

  if (value && typeof value === "object") {
    for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
      const unsafe = findUnsafePayloadPath(entryValue, entryKey, depth + 1);
      if (unsafe) return unsafe;
    }
  }

  return null;
}
