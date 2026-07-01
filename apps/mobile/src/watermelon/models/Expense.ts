import { Model } from "@nozbe/watermelondb";

import { watermelonTables } from "../tables";

export class ExpenseModel extends Model {
  static table = watermelonTables.expenses;
}
