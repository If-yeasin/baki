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
