import { Model } from "@nozbe/watermelondb";

import { watermelonTables } from "../tables";

export class GroupModel extends Model {
  static table = watermelonTables.groups;
}
