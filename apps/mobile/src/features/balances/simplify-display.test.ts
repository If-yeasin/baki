import type { GroupBalanceRow } from "@baki/db";
import { describe, expect, it } from "vitest";

import { buildSelfBalanceSummary, sumSelfNets } from "./simplify-display";

const names: Record<string, string> = {
  alice: "Alice",
  bob: "Bob",
  carol: "Carol"
};

const lookup = (id: string) => names[id];

describe("buildSelfBalanceSummary", () => {
  it("returns the self net and rows from the caller's perspective", () => {
    const rows: GroupBalanceRow[] = [
      { user_id: "alice", net_paisa: 1000 },
      { user_id: "bob", net_paisa: -600 },
      { user_id: "carol", net_paisa: -400 }
    ];

    const summary = buildSelfBalanceSummary(rows, "alice", lookup, "?");

    expect(summary.netPaisa).toBe(1000);
    expect(summary.rows).toHaveLength(2);
    // Both others have negative net from RPC, so caller is owed by both (flipped sign positive).
    expect(summary.rows.every((row) => row.netPaisa > 0)).toBe(true);
  });

  it("orders rows: caller-is-owed (desc) before caller-owes (asc by magnitude) before zeros", () => {
    const rows: GroupBalanceRow[] = [
      { user_id: "alice", net_paisa: -200 },
      { user_id: "bob", net_paisa: 500 }, // caller owes bob 500
      { user_id: "carol", net_paisa: -300 } // caller is owed 300 by carol
    ];

    const summary = buildSelfBalanceSummary(rows, "alice", lookup, "?");

    expect(summary.netPaisa).toBe(-200);
    expect(summary.rows.map((row) => row.counterpartyId)).toEqual(["carol", "bob"]);
  });

  it("falls back to placeholder name when lookup misses", () => {
    const rows: GroupBalanceRow[] = [
      { user_id: "alice", net_paisa: 100 },
      { user_id: "ghost", net_paisa: -100 }
    ];

    const summary = buildSelfBalanceSummary(rows, "alice", () => undefined, "Unknown");

    expect(summary.rows[0]?.counterpartyName).toBe("Unknown");
  });

  it("handles caller absent from rows (all settled for self)", () => {
    const summary = buildSelfBalanceSummary([], "alice", lookup, "?");

    expect(summary.netPaisa).toBe(0);
    expect(summary.rows).toEqual([]);
  });
});

describe("sumSelfNets", () => {
  it("adds signed nets across groups", () => {
    expect(sumSelfNets([100, -50, 25])).toBe(75);
    expect(sumSelfNets([])).toBe(0);
  });
});
