import { appSchema, tableSchema } from "@nozbe/watermelondb";

export const bakiSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: "groups",
      columns: [
        { name: "name", type: "string" },
        { name: "template", type: "string" },
        { name: "updated_at", type: "number" }
      ]
    }),
    tableSchema({
      name: "expenses",
      columns: [
        { name: "group_id", type: "string", isIndexed: true },
        { name: "amount_paisa", type: "number" },
        { name: "description", type: "string" },
        { name: "updated_at", type: "number" }
      ]
    })
  ]
});
