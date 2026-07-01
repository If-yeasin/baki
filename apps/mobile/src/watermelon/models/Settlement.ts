import { Model } from "@nozbe/watermelondb";

import { watermelonTables } from "../tables";

export class SettlementModel extends Model {
  static table = watermelonTables.settlements;
}
