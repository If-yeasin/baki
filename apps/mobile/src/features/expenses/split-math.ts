/**
 * Split-math primitives — pure functions, no I/O.
 *
 * Every function returns a Record<memberId, sharePaisa> whose values sum
 * exactly to the input `amountPaisa`. Rounding follows banker's rounding;
 * any remainder paisa is assigned to the payer (or the first listed
 * member when no payer is supplied).
 */

export class SplitMathError extends Error {
  public readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "SplitMathError";
    this.code = code;
    Object.setPrototypeOf(this, SplitMathError.prototype);
  }
}

export type SplitShares = Record<string, number>;

type SplitOptions = {
  /**
   * When set, the leftover paisa from rounding is assigned to this member.
   * Falls back to the first member id in the input.
   */
  payerId?: string;
};

function assertPositiveInteger(value: number, code: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new SplitMathError(code);
  }
}

function assertNonNegativeInteger(value: number, code: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new SplitMathError(code);
  }
}

/**
 * Banker's rounding (round half to even). Operates on a single value at
 * `precision` decimal places. We use this when allocating fractional paisa
 * from ratio-style splits.
 */
export function bankerRound(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;

  if (diff < 0.5) {
    return floor;
  }

  if (diff > 0.5) {
    return floor + 1;
  }

  // Exact .5 — round to even
  return floor % 2 === 0 ? floor : floor + 1;
}

function resolveLeftoverHolder(memberIds: readonly string[], options?: SplitOptions): string {
  const explicit = options?.payerId;

  if (explicit && memberIds.includes(explicit)) {
    return explicit;
  }

  const first = memberIds[0];

  if (!first) {
    throw new SplitMathError("members_required");
  }

  return first;
}

/**
 * Equal split — divide `amountPaisa` evenly across `memberIds`, push the
 * leftover paisa onto the payer (or first member).
 */
export function splitEqual(
  amountPaisa: number,
  memberIds: readonly string[],
  options?: SplitOptions
): Record<string, number> {
  assertPositiveInteger(amountPaisa, "amount_must_be_positive_integer");

  if (memberIds.length === 0) {
    throw new SplitMathError("members_required");
  }

  const baseShare = Math.floor(amountPaisa / memberIds.length);
  const remainder = amountPaisa - baseShare * memberIds.length;
  const leftoverHolder = resolveLeftoverHolder(memberIds, options);

  const result: Record<string, number> = {};
  for (const memberId of memberIds) {
    result[memberId] = memberId === leftoverHolder ? baseShare + remainder : baseShare;
  }

  return result;
}

/**
 * Exact split — the caller specifies the paisa per member. Throws if the
 * sum doesn't match `amountPaisa`.
 */
export function splitExact(amountPaisa: number, perMember: SplitShares): Record<string, number> {
  assertPositiveInteger(amountPaisa, "amount_must_be_positive_integer");

  const entries = Object.entries(perMember);

  if (entries.length === 0) {
    throw new SplitMathError("members_required");
  }

  let total = 0;
  const result: Record<string, number> = {};

  for (const [memberId, share] of entries) {
    assertNonNegativeInteger(share, "shares_must_be_non_negative_integer");
    total += share;
    result[memberId] = share;
  }

  if (total !== amountPaisa) {
    throw new SplitMathError("shares_must_sum");
  }

  return result;
}

/**
 * Percent split — each member's percent (0..100). Percents must sum to
 * exactly 100. Paisa allocations are rounded with banker's rounding;
 * any residual remainder is assigned to the payer (or first member).
 */
export function splitPercent(
  amountPaisa: number,
  perMember: SplitShares,
  options?: SplitOptions
): Record<string, number> {
  assertPositiveInteger(amountPaisa, "amount_must_be_positive_integer");

  const entries = Object.entries(perMember);

  if (entries.length === 0) {
    throw new SplitMathError("members_required");
  }

  let percentTotal = 0;

  for (const [, percent] of entries) {
    if (!Number.isFinite(percent) || percent < 0) {
      throw new SplitMathError("percent_must_be_non_negative");
    }
    percentTotal += percent;
  }

  // Allow a tiny floating-point tolerance, then require integer 100.
  if (Math.abs(percentTotal - 100) > 1e-6) {
    throw new SplitMathError("percent_must_sum_to_100");
  }

  const memberIds = entries.map(([memberId]) => memberId);
  const allocations: Record<string, number> = {};
  let allocated = 0;

  for (const [memberId, percent] of entries) {
    const share = bankerRound((amountPaisa * percent) / 100);
    allocations[memberId] = share;
    allocated += share;
  }

  const leftover = amountPaisa - allocated;

  if (leftover !== 0) {
    const holder = resolveLeftoverHolder(memberIds, options);
    allocations[holder] = (allocations[holder] ?? 0) + leftover;
  }

  return allocations;
}

/**
 * Shares split — ratio-style. Each member specifies a number of shares.
 * Sum must be > 0; allocations are rounded and the leftover lands on the
 * payer (or first member).
 */
export function splitShares(
  amountPaisa: number,
  perMember: SplitShares,
  options?: SplitOptions
): Record<string, number> {
  assertPositiveInteger(amountPaisa, "amount_must_be_positive_integer");

  const entries = Object.entries(perMember);

  if (entries.length === 0) {
    throw new SplitMathError("members_required");
  }

  let shareTotal = 0;

  for (const [, share] of entries) {
    if (!Number.isFinite(share) || share < 0) {
      throw new SplitMathError("shares_must_be_non_negative");
    }
    shareTotal += share;
  }

  if (shareTotal <= 0) {
    throw new SplitMathError("shares_must_be_positive");
  }

  const memberIds = entries.map(([memberId]) => memberId);
  const allocations: Record<string, number> = {};
  let allocated = 0;

  for (const [memberId, share] of entries) {
    const portion = bankerRound((amountPaisa * share) / shareTotal);
    allocations[memberId] = portion;
    allocated += portion;
  }

  const leftover = amountPaisa - allocated;

  if (leftover !== 0) {
    const holder = resolveLeftoverHolder(memberIds, options);
    allocations[holder] = (allocations[holder] ?? 0) + leftover;
  }

  return allocations;
}

export type SplitMethod = "equal" | "exact" | "percent" | "shares";
