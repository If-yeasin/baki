import { addColumns, schemaMigrations } from "@nozbe/watermelondb/Schema/migrations";

import { watermelonTables } from "./tables";

export const bakiMigrations = schemaMigrations({
  migrations: [
    {
      steps: [
        addColumns({
          columns: [
            { name: "client_mutation_id", type: "string", isOptional: true },
            { name: "sync_status", type: "string", isOptional: true }
          ],
          table: watermelonTables.expenses
        }),
        addColumns({
          columns: [
            { name: "client_mutation_id", type: "string", isOptional: true },
            { name: "sync_status", type: "string", isOptional: true },
            { name: "updated_at", type: "number", isOptional: true }
          ],
          table: watermelonTables.settlements
        })
      ],
      toVersion: 2
    }
  ]
});
