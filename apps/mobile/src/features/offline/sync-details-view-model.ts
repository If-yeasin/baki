import { formatRelativeDhakaDate, toBengaliNumerals, type AppLocale } from "@baki/i18n";

import type { QueuedMutation } from "./mutation-queue";
import type { QueuedMutationSyncSnapshot } from "./sync-orchestrator";

export type SyncDetailMetric = {
  label: string;
  tone: "negative" | "neutral" | "warning";
  value: string;
};

const safeDismissErrorCodes = new Set([
  "22023",
  "22P02",
  "23502",
  "23503",
  "23505",
  "23514",
  "28000",
  "42501",
  "P0001",
  "empty_result"
]);

export function formatSyncCount(value: number, locale: string) {
  return locale === "bn" ? toBengaliNumerals(value) : String(value);
}

export function formatSyncLastSync(
  snapshot: Pick<QueuedMutationSyncSnapshot, "lastSyncAt">,
  locale: AppLocale,
  fallback: string
) {
  return snapshot.lastSyncAt ? formatRelativeDhakaDate(snapshot.lastSyncAt, locale) : fallback;
}

export function buildSyncDetailMetrics({
  failedLabel,
  lastSyncLabel,
  locale,
  neverLabel,
  pendingLabel,
  snapshot
}: {
  failedLabel: string;
  lastSyncLabel: string;
  locale: AppLocale;
  neverLabel: string;
  pendingLabel: string;
  snapshot: QueuedMutationSyncSnapshot;
}): SyncDetailMetric[] {
  return [
    {
      label: pendingLabel,
      tone: "warning",
      value: formatSyncCount(snapshot.pendingCount, locale)
    },
    {
      label: failedLabel,
      tone: "negative",
      value: formatSyncCount(snapshot.failedCount, locale)
    },
    {
      label: lastSyncLabel,
      tone: "neutral",
      value: formatSyncLastSync(snapshot, locale, neverLabel)
    }
  ];
}

export function selectFailedQueuedMutations(queuedMutations: readonly QueuedMutation[]) {
  return queuedMutations.filter((mutation) => mutation.status === "failed");
}

export function canDismissFailedQueuedMutation(mutation: QueuedMutation) {
  return (
    mutation.status === "failed" &&
    Boolean(mutation.lastErrorCode && safeDismissErrorCodes.has(mutation.lastErrorCode))
  );
}

export function redactSensitiveSyncText(value: string) {
  return value
    .replace(/\+?8801\d{9}\b/g, "[redacted-phone]")
    .replace(/\b01\d{9}\b/g, "[redacted-phone]")
    .replace(/\b(?:Bearer\s+)?eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-jwt]")
    .replace(/\b(otp|token|external_ref|externalRef)\s*[:=]\s*["']?[^"',\s}]+/gi, "$1=[redacted]")
    .replace(/ExponentPushToken\[[^\]]+\]/g, "ExponentPushToken[redacted]");
}

export function formatFailedQueuedMutationSubtitle(
  mutation: QueuedMutation,
  fallback: string
) {
  const message = mutation.lastErrorMessage ?? fallback;
  return mutation.lastErrorCode
    ? `${mutation.lastErrorCode} · ${redactSensitiveSyncText(message)}`
    : redactSensitiveSyncText(message);
}

export function buildFailedQueuedMutationDebugText(mutation: QueuedMutation) {
  return redactSensitiveSyncText(
    JSON.stringify(
      {
        createdAt: mutation.createdAt,
        failedAt: mutation.failedAt,
        id: mutation.id,
        lastErrorCode: mutation.lastErrorCode,
        lastErrorMessage: mutation.lastErrorMessage,
        retryCount: mutation.retryCount,
        status: mutation.status,
        type: mutation.type
      },
      null,
      2
    )
  );
}
