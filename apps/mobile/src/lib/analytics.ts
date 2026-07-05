import {
  type AnalyticsEventName,
  type AnalyticsPayload,
  type AnalyticsPrimitive,
  createAnalyticsEvent
} from "@baki/monetization";

import { Sentry } from "./sentry";

const SAFE_ANALYTICS_PAYLOAD_KEYS = new Set([
  "billingDisabledReason",
  "featureId",
  "format",
  "locale",
  "paywall",
  "planKey",
  "reportType",
  "result",
  "source",
  "surface"
]);

export function trackAnalyticsEvent(name: AnalyticsEventName, payload: AnalyticsPayload = {}) {
  const event = createAnalyticsEvent(name, pickSafeAnalyticsPayload(payload));

  Sentry.addBreadcrumb({
    category: "analytics",
    data: event.payload,
    level: "info",
    message: event.name
  });

  return event;
}

function pickSafeAnalyticsPayload(payload: AnalyticsPayload): AnalyticsPayload {
  const safePayload: Record<string, AnalyticsPrimitive> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (!SAFE_ANALYTICS_PAYLOAD_KEYS.has(key) || !isAnalyticsPrimitive(value)) continue;
    safePayload[key] = value;
  }

  return safePayload;
}

function isAnalyticsPrimitive(value: unknown): value is AnalyticsPrimitive {
  return value === null || ["boolean", "number", "string"].includes(typeof value);
}
