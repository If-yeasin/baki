import { formatRelativeDhakaDate, toBengaliNumerals, type AppLocale } from "@baki/i18n";

import type { QueuedMutation } from "./mutation-queue";
import type { QueuedMutationSyncSnapshot } from "./sync-orchestrator";

export type SyncDetailMetric = {
  label: string;
  tone: "negative" | "neutral" | "warning";
  value: string;
};

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
