import type { Database } from "@nozbe/watermelondb";

import { isExpoGo } from "../lib/expo-runtime";
import { Sentry } from "../lib/sentry";

import { bakiMigrations } from "./migrations";
import {
  ActivityLogModel,
  ExpenseModel,
  ExpenseShareModel,
  GroupMemberModel,
  GroupModel,
  SettlementModel
} from "./models";
import { bakiSchema } from "./schema";

let database: Database | null | undefined;

export function getBakiDatabase(): Database | null {
  if (isExpoGo) {
    return null;
  }

  if (database !== undefined) {
    return database;
  }

  try {
    // Native-only modules must stay lazy so Expo Go can still render UI smoke.
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { Database: WatermelonDatabase } =
      require("@nozbe/watermelondb") as typeof import("@nozbe/watermelondb");
    const SQLiteAdapter = require("@nozbe/watermelondb/adapters/sqlite")
      .default as typeof import("@nozbe/watermelondb/adapters/sqlite").default;
    /* eslint-enable @typescript-eslint/no-require-imports */

    const adapter = new SQLiteAdapter({
      dbName: "baki",
      migrations: bakiMigrations,
      schema: bakiSchema
    });

    database = new WatermelonDatabase({
      adapter,
      modelClasses: [
        ActivityLogModel,
        ExpenseModel,
        ExpenseShareModel,
        GroupMemberModel,
        GroupModel,
        SettlementModel
      ]
    });
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: "watermelon.database" } });
    database = null;
  }

  return database;
}
