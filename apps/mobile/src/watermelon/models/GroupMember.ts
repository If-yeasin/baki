import { Model } from "@nozbe/watermelondb";

import { watermelonTables } from "../tables";

export class GroupMemberModel extends Model {
  static table = watermelonTables.groupMembers;
}
