import type { Model } from "@nozbe/watermelondb";

import { getBakiDatabase } from "../database";
import { assignRaw, readRaw, type LocalRawRecord } from "../mappers";
import type { WatermelonTableName } from "../tables";

export async function fetchLocalRows<T extends LocalRawRecord>(
  table: WatermelonTableName
): Promise<T[]> {
  const database = getBakiDatabase();
  if (!database) {
    return [];
  }

  const records = await database.collections.get<Model>(table).query().fetch();
  return records.map((record) => readRaw<T>(record));
}

export async function upsertLocalRows<T extends LocalRawRecord>(
  table: WatermelonTableName,
  rows: readonly T[]
) {
  const database = getBakiDatabase();
  if (!database || rows.length === 0) {
    return;
  }

  await database.write(async () => {
    const collection = database.collections.get<Model>(table);

    for (const row of rows) {
      try {
        const existing = await collection.find(row.id);
        await existing.update((record) => {
          assignRaw(record, row);
        });
      } catch {
        await collection.create((record) => {
          assignRaw(record, row);
        });
      }
    }
  });
}
