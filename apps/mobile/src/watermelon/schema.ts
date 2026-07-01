import { appSchema, tableSchema } from "@nozbe/watermelondb";

import { watermelonTables } from "./tables";

export const bakiSchema = appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: watermelonTables.groups,
      columns: [
        { name: "name", type: "string" },
        { name: "template", type: "string" },
        { name: "invite_code", type: "string", isOptional: true },
        { name: "created_by", type: "string", isIndexed: true },
        { name: "archived_at", type: "number", isOptional: true },
        { name: "deleted_at", type: "number", isOptional: true },
        { name: "updated_at", type: "number", isOptional: true }
      ]
    }),
    tableSchema({
      name: watermelonTables.groupMembers,
      columns: [
        { name: "group_id", type: "string", isIndexed: true },
        { name: "user_id", type: "string", isIndexed: true },
        { name: "role", type: "string" },
        { name: "joined_at", type: "number" },
        { name: "left_at", type: "number", isOptional: true }
      ]
    }),
    tableSchema({
      name: watermelonTables.expenses,
      columns: [
        { name: "group_id", type: "string", isIndexed: true },
        { name: "amount_paisa", type: "number" },
        { name: "description", type: "string" },
        { name: "category", type: "string" },
        { name: "paid_by", type: "string", isIndexed: true },
        { name: "split_method", type: "string" },
        { name: "occurred_at", type: "number" },
        { name: "note", type: "string", isOptional: true },
        { name: "receipt_url", type: "string", isOptional: true },
        { name: "client_mutation_id", type: "string", isOptional: true },
        { name: "created_by", type: "string", isIndexed: true },
        { name: "deleted_at", type: "number", isOptional: true },
        { name: "sync_status", type: "string", isOptional: true },
        { name: "updated_at", type: "number" }
      ]
    }),
    tableSchema({
      name: watermelonTables.expenseShares,
      columns: [
        { name: "expense_id", type: "string", isIndexed: true },
        { name: "user_id", type: "string", isIndexed: true },
        { name: "share_paisa", type: "number" }
      ]
    }),
    tableSchema({
      name: watermelonTables.settlements,
      columns: [
        { name: "group_id", type: "string", isIndexed: true },
        { name: "from_user", type: "string", isIndexed: true },
        { name: "to_user", type: "string", isIndexed: true },
        { name: "amount_paisa", type: "number" },
        { name: "method", type: "string" },
        { name: "external_ref", type: "string", isOptional: true },
        { name: "client_mutation_id", type: "string", isOptional: true },
        { name: "occurred_at", type: "number" },
        { name: "sync_status", type: "string", isOptional: true },
        { name: "updated_at", type: "number" }
      ]
    }),
    tableSchema({
      name: watermelonTables.activityLog,
      columns: [
        { name: "group_id", type: "string", isIndexed: true },
        { name: "actor_id", type: "string", isIndexed: true },
        { name: "event_type", type: "string" },
        { name: "payload", type: "string" },
        { name: "created_at", type: "number" }
      ]
    })
  ]
});
