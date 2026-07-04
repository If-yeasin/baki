import type { ComponentType } from "react";

import { isExpoGo } from "./expo-runtime";

type Tags = Record<string, string | number | boolean>;
type SeverityLevel = "fatal" | "error" | "warning" | "log" | "info" | "debug";
type Breadcrumb = {
  category?: string;
  data?: Record<string, unknown>;
  level?: SeverityLevel;
  message?: string;
};

const sensitiveKeyPattern = /(authorization|bearer|jwt|otp|token|phone|bkash|nagad|external_?ref)/i;

export function redactSensitiveSentryText(value: string) {
  return value
    .replace(/\+?8801\d{9}\b/g, "[redacted-phone]")
    .replace(/\b01\d{9}\b/g, "[redacted-phone]")
    .replace(/\b(?:Bearer\s+)?eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-jwt]")
    .replace(/\b(otp|token|external_ref|externalRef)\s*[:=]\s*["']?[^"',\s}]+/gi, "$1=[redacted]")
    .replace(/ExponentPushToken\[[^\]]+\]/g, "ExponentPushToken[redacted]");
}

export function redactSentryPayload<T>(payload: T): T {
  return redactUnknown(payload) as T;
}

function redactUnknown(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return redactSensitiveSentryText(value);
  if (value === null || typeof value !== "object") return value;
  if (depth > 6) return "[redacted-depth]";
  if (Array.isArray(value)) return value.map((entry) => redactUnknown(entry, depth + 1));

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      sensitiveKeyPattern.test(key) && entry != null
        ? "[redacted]"
        : redactUnknown(entry, depth + 1)
    ])
  );
}

export interface SentryShim {
  captureException(error: unknown, ctx?: { tags?: Tags }): void;
  captureMessage(msg: string, ctx?: { tags?: Tags }): void;
  addBreadcrumb(b: Breadcrumb): void;
  wrap<TProps extends Record<string, unknown>>(
    component: ComponentType<TProps>
  ): ComponentType<TProps>;
}

let impl: SentryShim;

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

if (isExpoGo || !sentryDsn) {
  impl = {
    addBreadcrumb: () => {},
    captureException: () => {},
    captureMessage: () => {},
    wrap: (component) => component
  };
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Native = require("@sentry/react-native") as typeof import("@sentry/react-native");
  Native.init({
    beforeBreadcrumb: (breadcrumb) => redactSentryPayload(breadcrumb),
    beforeSend: (event) => redactSentryPayload(event),
    dsn: sentryDsn,
    enableNative: true
  });

  impl = {
    addBreadcrumb: (b) => Native.addBreadcrumb(b),
    captureException: (e, ctx) => {
      Native.captureException(e, ctx);
    },
    captureMessage: (m, ctx) => {
      Native.captureMessage(m, ctx);
    },
    wrap: (component) => Native.wrap(component)
  };
}

export const Sentry: SentryShim = impl;
