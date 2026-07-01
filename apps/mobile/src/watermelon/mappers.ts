import type { Model } from "@nozbe/watermelondb";

export type LocalRawRecord = { id: string } & object;

type MutableWatermelonRecord = Model & {
  _raw: Record<string, unknown> & { id: string };
};

export function toWatermelonTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function fromWatermelonTimestamp(value: number | null | undefined): string | null {
  return typeof value === "number" ? new Date(value).toISOString() : null;
}

export function requiredTimestamp(value: string | null | undefined): number {
  return toWatermelonTimestamp(value) ?? Date.now();
}

export function assignRaw(record: Model, values: LocalRawRecord) {
  Object.assign((record as MutableWatermelonRecord)._raw, values);
}

export function readRaw<T extends LocalRawRecord>(record: Model): T {
  return { ...(record as MutableWatermelonRecord)._raw } as unknown as T;
}
