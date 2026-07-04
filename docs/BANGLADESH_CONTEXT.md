# BANGLADESH_CONTEXT.md

## Localization

### Languages

- `bn` (Bengali) — default, all copy reviewed by native speaker
- `en` (English) — secondary, used by international users and bilingual segments

### Numerals

- When locale is `bn`, render digits in Bengali: ০১২৩৪৫৬৭৮৯
- Helper: `toBengaliNumerals(str)` and `toLatinNumerals(str)` — always store in Latin, convert at render

### Currency formatting

- Symbol: ৳ (Bengali) or BDT (English context where ৳ doesn't render)
- Format: `৳ 1,23,450` (Indian-style grouping: lakh, crore — NOT thousands)
- Negative: prefix with minus, or wrap in parentheses; never red text alone (accessibility)

### Date/time

- Display timezone: Asia/Dhaka (UTC+6)
- Relative dates in Bengali:
  - 0 days: "আজ"
  - 1 day: "গতকাল"
  - 2–6 days: "X দিন আগে"
  - 7+ days: absolute date "১৫ মে, ২০২৫"
- Use `dayjs` with `bn` locale + custom Bengali numerals formatter

### Phone numbers

- BD format: `+880 1XXX-XXXXXX` (11 digits after +880)
- Validate: must start with `01[3-9]` after country code
- Display in groups: `+880 17XX-XXXXXX`
- Operator codes (FYI for analytics, not validation):
  - GP: 017, 013
  - Robi: 018, 016 (Airtel merged)
  - Banglalink: 019, 014
  - Teletalk: 015

## Mobile Financial Services (MFS)

### bKash

**Deep link (send money):**
Investigate and lock the exact scheme — schemes have changed historically. As of last documented integration, the iOS scheme is `bkashopen://` and Android uses an intent. The integration in `packages/payments/src/bkash.ts` should:

1. Try the universal link first
2. Fall back to the custom scheme
3. Fall back to copy-the-number-to-clipboard with a toast: "bKash app not found, number copied"

**Prefill data possible:**

- Recipient number
- Amount (BDT)
- Reference/note (limited characters)

**Critical:** the user must always confirm in the bKash app — we never authorize or settle on their behalf. Our app only marks the local ledger as settled after user confirmation.

**Merchant API (v1.5+):**
Requires bKash merchant onboarding (corporate registration, TIN, trade license, BIN). Out of scope for v1. When in scope:

- Tokenized checkout for in-app settlement
- Webhook to auto-confirm settlements
- Reconciliation via `external_ref` in `settlements` table

### Nagad

- Deep link support is more limited than bKash; default to USSD copy:
- Provide a "copy \*167# command with prefilled number" affordance
- Same fallback pattern as bKash

### Rocket / Upay / Other

Out of scope for v1. Allow "Other" as a settlement method with a free-text note.

## Cultural and UX considerations

- **Respect for elders:** family groups often include parents/uncles who pay disproportionately. The "shares" split method handles this gracefully.
- **Ramadan:** iftar parties create a spike in group expense activity. Consider a Ramadan-themed empty illustration during the month (subtle, not gimmicky).
- **Eid:** users gift money (salami/Eidi). Allow "gift" category and don't auto-include the recipient in the split.
- **Mess/hostel culture:** monthly cycles, with a "মেস ম্যানেজার" rotating role. The mess template should make the manager role explicit (admin role assignment).
- **"ভাই পরে দিচ্ছি" problem:** the polite-deferral pattern. Don't make reminders aggressive. Default reminder cadence: 7 days after a balance exists. Tone: gentle.

## Bengali copy guidelines

- Use everyday spoken-register Bengali, not formal/literary
- Mix in common English loanwords where natural: "ম্যানেজার", "ট্রিপ", "শেয়ার", "সেটেল"
- Avoid Sanskrit-heavy formal Bengali (e.g., "মূল্য পরিশোধ করুন" → use "টাকা দাও")
- Always test long Bengali strings — they tend to be 20–40% longer than English equivalents and break layouts
- Have a native speaker review before each release; mark copy strings with `// reviewed: bn` once approved

## Sample translation keys

```json
// bn.json (excerpt)
{
  "auth.welcome": "স্বাগতম",
  "auth.phone.label": "ফোন নম্বর",
  "auth.otp.title": "OTP দিন",
  "groups.create.title": "নতুন খাতা",
  "groups.template.mess": "মেস",
  "groups.template.family": "পরিবার",
  "groups.template.trip": "ট্রিপ",
  "groups.template.event": "ইভেন্ট",
  "expense.add.title": "খরচ যোগ করো",
  "expense.amount.label": "কত টাকা?",
  "balance.you_owe": "তুমি দিবে",
  "balance.you_are_owed": "তুমি পাবে",
  "balance.all_settled": "সব হিসাব মিটে গেছে",
  "settle.via.bkash": "বিকাশে দাও",
  "settle.via.nagad": "নগদে দাও",
  "settle.via.cash": "ক্যাশে দিয়েছি"
}
```

## Connectivity assumptions

- Significant portion of users on 2G/3G with intermittent connectivity
- Outside Dhaka, expect frequent dropouts
- Cellular data is metered — keep payloads small, lazy-load receipt images
- Offline must be a first-class state, not a degraded one

## Legal & compliance

- We are not a payment processor. We never hold user funds.
- Privacy policy explicit about: phone number storage, optional bKash/Nagad number storage for settlement handoff, no raw MFS numbers in logs/support screenshots, no NID, no financial KYC
- Terms: arbitration in Dhaka, governing law of Bangladesh
- Apple App Store: classify as "Finance" but emphasize "expense tracker" in metadata to avoid "Money Transmitter" scrutiny
- DPI laws of Bangladesh (Digital Security Act): be mindful of user data; do not log message contents
