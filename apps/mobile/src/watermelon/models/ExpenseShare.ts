import { Model } from "@nozbe/watermelondb";

import { watermelonTables } from "../tables";

export class ExpenseShareModel extends Model {
  static table = watermelonTables.expenseShares;
}
