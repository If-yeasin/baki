import { Model } from "@nozbe/watermelondb";

import { watermelonTables } from "../tables";

export class ActivityLogModel extends Model {
  static table = watermelonTables.activityLog;
}
