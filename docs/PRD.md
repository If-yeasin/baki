# PRD — বাকি (Baki)

## 1. Problem

In Bangladesh, friends and families constantly share expenses: mess bills, hostel rents, group trips to Sajek or Cox's Bazar, iftar parties, wedding cost-splits between cousins, family utility bills. The status quo is a WhatsApp screenshot, a paper খাতা at the corner shop, or "ভাই পরে দিচ্ছি" — which everyone forgets. Global shared-expense apps exist but feel foreign: USD-first, no MFS settlement, English-only, no offline mode for spotty data.

## 2. Vision

বাকি is the digital খাতা every Bangladeshi already understands. Open it, add a expense, see who owes whom, tap to settle via bKash. No spreadsheet, no awkward reminders.

## 3. Target users (v1)

- **University and college students** (hostels, messes, group projects, study tours)
- **Young professionals in Dhaka/Chattogram/Sylhet** (flatmates, monthly utility splits, friend trips)
- **Extended families** (shared family expenses, parents' medical bills, eid contributions)
- **Friend groups planning trips** (Sajek, Bandarban, Cox's, Sundarbans, abroad)

Personas:
- *Tanvir, 22, BUET hostel:* tracks mess bill across 8 boys, gets paid back via bKash
- *Rini, 28, Dhanmondi flat:* splits rent, gas, internet with 2 flatmates monthly
- *Ahsan, 35, Chattogram:* coordinates 4 siblings sharing father's medical costs

## 4. Goals & non-goals (v1)

### Goals
- Add an expense in under 15 seconds
- See "who owes whom" with one tap
- Settle via bKash/Nagad with one tap (deep link)
- Work fully offline; sync when online
- Bengali default, English toggle
- Ship to App Store first, Play Store within 6 weeks of iOS launch

### Non-goals (v1)
- Receipt OCR (v2)
- Recurring expenses (v2)
- Multi-currency (v2)
- Web app (v2)
- Friends without groups (v2)
- In-app bKash merchant API (v1.5 — start with deep links)
- Bank transfers / cards (v3)

## 5. Success metrics (first 90 days post-launch)

- **5,000 installs** (organic + light social push)
- **40% D7 retention** (industry benchmark for finance utility)
- **3 groups per active user** (signals real adoption, not just curiosity)
- **15% of expenses settled via bKash deep link** (validates the killer feature)
- **App Store rating ≥ 4.5**

## 6. Critical user journeys (must work perfectly)

1. **First-run:** install → phone OTP → land on empty state with a "create your first khata" prompt
2. **Create a group:** name → template (mess/family/trip/event) → invite via share link
3. **Add expense:** amount → who paid → who shares (all / custom) → split method (equal/exact/percent) → save
4. **See balances:** group screen shows simplified "Tanvir owes you ৳450, you owe Rini ৳120"
5. **Settle:** tap "Settle" → choose bKash → app opens bKash with prefilled amount → user confirms → mark as paid

## 7. Out-of-scope clarifications

- We are not a banking app. We track ledgers and link to bKash/Nagad — we never hold money.
- We are not a budgeting app. Personal finance tracking is out of scope.
- We do not need NID/KYC. Phone OTP only.

## 8. Risk register

| Risk | Mitigation |
|---|---|
| bKash deep-link API changes | Wrap in `packages/payments`, version-pinned, fall back to copy-to-clipboard |
| Apple rejects for "financial app" classification | Position as "expense tracker", not "payments app"; no money custody language |
| Bengali font rendering inconsistent on older iPhones | Bundle Hind Siliguri locally, test on iPhone SE 2 minimum |
| Cross-group data leak via RLS gap | Mandatory two-user RLS test in every PR touching the schema |
| Sync conflicts when two users edit offline | Last-write-wins with audit trail; show "edited by X" in activity feed |
