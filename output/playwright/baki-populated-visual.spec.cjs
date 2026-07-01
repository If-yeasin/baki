const { expect, test } = require("@playwright/test");

const USER_ID = "11111111-1111-4111-8111-111111111111";
const RINI_ID = "22222222-2222-4222-8222-222222222222";
const SAJEK_ID = "33333333-3333-4333-8333-333333333333";
const FLAT_ID = "66666666-6666-4666-8666-666666666666";
const MESS_ID = "77777777-7777-4777-8777-777777777777";

const groups = [
  {
    archived_at: null,
    avatar_url: null,
    created_at: "2026-06-25T08:00:00.000Z",
    created_by: USER_ID,
    deleted_at: null,
    id: SAJEK_ID,
    invite_code: "sajek1",
    name: "Sajek Trip",
    template: "trip",
    updated_at: "2026-06-29T08:00:00.000Z"
  },
  {
    archived_at: null,
    avatar_url: null,
    created_at: "2026-06-20T08:00:00.000Z",
    created_by: USER_ID,
    deleted_at: null,
    id: FLAT_ID,
    invite_code: "flat88",
    name: "Dhanmondi Flat",
    template: "family",
    updated_at: "2026-06-28T08:00:00.000Z"
  },
  {
    archived_at: null,
    avatar_url: null,
    created_at: "2026-06-18T08:00:00.000Z",
    created_by: USER_ID,
    deleted_at: null,
    id: MESS_ID,
    invite_code: "buet24",
    name: "BUET Mess",
    template: "mess",
    updated_at: "2026-06-26T08:00:00.000Z"
  }
];

const expenses = [
  {
    amount_paisa: 120000,
    category: "transport",
    created_at: "2026-06-28T09:00:00.000Z",
    created_by: USER_ID,
    deleted_at: null,
    description: "Jeep fare",
    group_id: SAJEK_ID,
    id: "44444444-4444-4444-8444-444444444441",
    note: null,
    occurred_at: "2026-06-28T09:00:00.000Z",
    paid_by: USER_ID,
    receipt_url: null,
    split_method: "equal",
    updated_at: "2026-06-28T09:00:00.000Z"
  },
  {
    amount_paisa: 80000,
    category: "food",
    created_at: "2026-06-27T15:00:00.000Z",
    created_by: RINI_ID,
    deleted_at: null,
    description: "Dinner",
    group_id: SAJEK_ID,
    id: "44444444-4444-4444-8444-444444444442",
    note: null,
    occurred_at: "2026-06-27T15:00:00.000Z",
    paid_by: RINI_ID,
    receipt_url: null,
    split_method: "equal",
    updated_at: "2026-06-27T15:00:00.000Z"
  },
  {
    amount_paisa: 50000,
    category: "food",
    created_at: "2026-06-26T11:00:00.000Z",
    created_by: USER_ID,
    deleted_at: null,
    description: "Snacks",
    group_id: SAJEK_ID,
    id: "44444444-4444-4444-8444-444444444443",
    note: null,
    occurred_at: "2026-06-26T11:00:00.000Z",
    paid_by: USER_ID,
    receipt_url: null,
    split_method: "equal",
    updated_at: "2026-06-26T11:00:00.000Z"
  },
  {
    amount_paisa: 520000,
    category: "rent",
    created_at: "2026-06-29T10:00:00.000Z",
    created_by: RINI_ID,
    deleted_at: null,
    description: "June rent",
    group_id: FLAT_ID,
    id: "44444444-4444-4444-8444-444444444444",
    note: null,
    occurred_at: "2026-06-29T10:00:00.000Z",
    paid_by: RINI_ID,
    receipt_url: null,
    split_method: "equal",
    updated_at: "2026-06-29T10:00:00.000Z"
  },
  {
    amount_paisa: 180000,
    category: "utility",
    created_at: "2026-06-28T18:00:00.000Z",
    created_by: USER_ID,
    deleted_at: null,
    description: "Internet bill",
    group_id: FLAT_ID,
    id: "44444444-4444-4444-8444-444444444445",
    note: null,
    occurred_at: "2026-06-28T18:00:00.000Z",
    paid_by: USER_ID,
    receipt_url: null,
    split_method: "equal",
    updated_at: "2026-06-28T18:00:00.000Z"
  }
];

function json(route, body, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": "*"
    },
    status
  });
}

function balancesFor(groupId) {
  if (groupId === FLAT_ID) {
    return [
      { net_paisa: -120000, user_id: USER_ID },
      { net_paisa: 120000, user_id: RINI_ID }
    ];
  }
  if (groupId === MESS_ID) {
    return [];
  }
  return [
    { net_paisa: 20000, user_id: USER_ID },
    { net_paisa: -20000, user_id: RINI_ID }
  ];
}

async function expectSettingsNotice(page, testId, messagePattern) {
  await page.getByTestId(testId).click();
  const notice = page.getByTestId("settings-notice");
  await expect(notice).toBeVisible({ timeout: 8000 });
  await expect(notice).toContainText(messagePattern);
}

test("capture populated Baki ledger states", async ({ page }) => {
  await page.setViewportSize({ height: 932, width: 430 });
  await page.addInitScript(
    ({ userId }) => {
      const session = {
        access_token: "mock-access-token",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        refresh_token: "mock-refresh-token",
        token_type: "bearer",
        user: {
          app_metadata: { provider: "phone", providers: ["phone"] },
          aud: "authenticated",
          confirmed_at: "2026-06-25T08:00:00.000Z",
          created_at: "2026-06-25T08:00:00.000Z",
          id: userId,
          phone: "+8801700000001",
          role: "authenticated",
          updated_at: "2026-06-25T08:00:00.000Z",
          user_metadata: {}
        }
      };
      window.localStorage.setItem("baki\\auth.userId.v1", userId);
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = function getBakiPreviewValue(key) {
        if (key === "baki\\auth.userId.v1") return userId;
        if (typeof key === "string" && key.includes("auth-token")) {
          return JSON.stringify(session);
        }
        return originalGetItem.call(this, key);
      };
    },
    { userId: USER_ID }
  );

  await page.route("**/auth/v1/user**", (route) =>
    json(route, {
      app_metadata: { provider: "phone", providers: ["phone"] },
      aud: "authenticated",
      confirmed_at: "2026-06-25T08:00:00.000Z",
      created_at: "2026-06-25T08:00:00.000Z",
      id: USER_ID,
      phone: "+8801700000001",
      role: "authenticated",
      updated_at: "2026-06-25T08:00:00.000Z",
      user_metadata: {}
    })
  );

  await page.route("**/rest/v1/groups?**", (route) => {
    const requestUrl = route.request().url();
    const group = groups.find((entry) => requestUrl.includes(`id=eq.${entry.id}`));
    if (group) {
      return json(route, group);
    }
    return json(route, groups);
  });

  await page.route("**/rest/v1/group_members?**", (route) => {
    const requestUrl = decodeURIComponent(route.request().url());
    const group = groups.find((entry) => requestUrl.includes(`group_id=eq.${entry.id}`));
    const members = [
      {
        group_id: SAJEK_ID,
        joined_at: "2026-06-25T08:00:00.000Z",
        left_at: null,
        profiles: { display_name: "Tanvir" },
        role: "admin",
        user_id: USER_ID
      },
      {
        group_id: SAJEK_ID,
        joined_at: "2026-06-25T08:00:00.000Z",
        left_at: null,
        profiles: { display_name: "Rini" },
        role: "member",
        user_id: RINI_ID
      },
      {
        group_id: FLAT_ID,
        joined_at: "2026-06-20T08:00:00.000Z",
        left_at: null,
        profiles: { display_name: "Tanvir" },
        role: "member",
        user_id: USER_ID
      },
      {
        group_id: FLAT_ID,
        joined_at: "2026-06-20T08:00:00.000Z",
        left_at: null,
        profiles: { display_name: "Rini" },
        role: "admin",
        user_id: RINI_ID
      }
    ];

    return json(route, group ? members.filter((member) => member.group_id === group.id) : members);
  });

  await page.route("**/rest/v1/profiles?**", (route) => {
    const requestUrl = decodeURIComponent(route.request().url());
    const profiles = [
      {
        bkash_number: "+8801712345678",
        display_name: "Rini",
        id: RINI_ID,
        nagad_number: "+8801812345678",
        phone: "+8801712345678"
      },
      {
        bkash_number: "+8801700000001",
        display_name: "Tanvir",
        id: USER_ID,
        nagad_number: "+8801900000001",
        phone: "+8801700000001"
      }
    ];

    if (
      requestUrl.includes("select=display_name") &&
      requestUrl.includes("phone") &&
      requestUrl.includes(`id=eq.${USER_ID}`)
    ) {
      return json(route, {
        display_name: "Tanvir",
        phone: "+8801700000001"
      });
    }

    const filtered = profiles.filter((profile) => requestUrl.includes(profile.id));
    return json(route, filtered.length > 0 ? filtered : profiles);
  });

  await page.route("**/rest/v1/expenses?**", (route) => {
    const requestUrl = decodeURIComponent(route.request().url());
    const group = groups.find((entry) => requestUrl.includes(`group_id=eq.${entry.id}`));
    return json(
      route,
      group ? expenses.filter((expense) => expense.group_id === group.id) : expenses
    );
  });

  await page.route("**/rest/v1/rpc/get_group_balances**", async (route) => {
    const body = route.request().postDataJSON();
    return json(route, balancesFor(body?.p_group_id));
  });

  await page.goto("http://localhost:8090/(tabs)", { waitUntil: "networkidle" });
  await page.getByText("Sajek Trip").waitFor({ timeout: 8000 });
  await page
    .getByText(/তুমি পাবে|You are owed/)
    .first()
    .waitFor({ timeout: 8000 });
  await expect(page.getByTestId("home-next-action")).toContainText(/পরের সেটেল|Next to settle/);
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-home.png"
  });
  await page.getByTestId("groups-search-input").fill("Flat");
  await expect(page.getByText("Dhanmondi Flat")).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("Sajek Trip")).not.toBeVisible();
  await page.getByTestId("groups-search-input").fill("Nope");
  await page.getByTestId("groups-search-empty-state").waitFor({ timeout: 8000 });
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-home-search-empty.png"
  });

  await page.goto("http://localhost:8090/balances", { waitUntil: "networkidle" });
  await page.getByTestId(`balances-group-row-${FLAT_ID}`).waitFor({ timeout: 8000 });
  await page
    .getByText(/তুমি দিবে|You owe/)
    .first()
    .waitFor({ timeout: 8000 });
  await expect(page.getByTestId("balances-person-queue")).toContainText(
    /কার সাথে কত|Who owes what/
  );
  await expect(page.getByTestId("balances-person-queue")).toContainText("Rini");
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-balances.png"
  });
  await page.getByTestId("balances-search-input").fill("Mess");
  await expect(page.getByText("BUET Mess")).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("Dhanmondi Flat")).not.toBeVisible();
  await page.getByTestId("balances-search-input").fill("Nope");
  await page.getByTestId("balances-search-empty-state").waitFor({ timeout: 8000 });
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-balances-search-empty.png"
  });

  await page.goto("http://localhost:8090/activity", { waitUntil: "networkidle" });
  await page.getByText("June rent").waitFor({ timeout: 8000 });
  await expect(page.getByTestId("activity-summary-card")).toContainText(/তুমি দিয়েছ|You paid/);
  await expect(page.getByTestId("activity-summary-card")).toContainText(
    /অন্যরা দিয়েছে|Others paid/
  );
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-activity.png"
  });
  await page.getByTestId("activity-search-input").fill("Dinner");
  await expect(page.getByText("Dinner")).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("June rent")).not.toBeVisible();
  await page.getByTestId("activity-search-input").fill("Nope");
  await page.getByTestId("activity-search-empty-state").waitFor({ timeout: 8000 });
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-activity-search-empty.png"
  });

  await page.goto(`http://localhost:8090/group/${SAJEK_ID}`, { waitUntil: "networkidle" });
  await page.getByText("Jeep fare").waitFor({ timeout: 8000 });
  await page.getByTestId("group-balance-action-card").waitFor({ timeout: 8000 });
  await page.getByTestId("group-members-strip").waitFor({ timeout: 8000 });
  await page.getByTestId("group-ledger-summary").waitFor({ timeout: 8000 });
  await expect(page.getByTestId("group-members-strip")).toContainText(/সদস্যরা|Members/);
  await expect(page.getByTestId("group-members-strip")).toContainText("Tanvir");
  await expect(page.getByTestId("group-members-strip")).toContainText("Rini");
  await expect(page.getByTestId("group-members-strip")).toContainText(/অ্যাডমিন|Admin/);
  await expect(page.getByTestId("group-members-strip")).toContainText(/সদস্য|Member/);
  await expect(page.getByTestId("group-ledger-summary")).toContainText(/মোট খরচ|Total spent/);
  await page
    .getByText(/পরের কাজ|Next up/)
    .first()
    .waitFor({ timeout: 8000 });
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-group-detail.png"
  });

  await page.goto(`http://localhost:8090/group/${FLAT_ID}`, { waitUntil: "networkidle" });
  await page.getByText("June rent").waitFor({ timeout: 8000 });
  await page.getByTestId("group-people-balance-preview").waitFor({ timeout: 8000 });
  await expect(page.getByTestId("group-people-balance-preview")).toContainText(/সেটেল|Settle/);
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-group-detail-debt.png"
  });

  await page.goto(`http://localhost:8090/group/${SAJEK_ID}/add-expense`, {
    waitUntil: "networkidle"
  });
  await page.getByText(/খাতা: Sajek Trip|With Sajek Trip/).waitFor({ timeout: 8000 });
  await page.getByTestId("amount-input").fill("1200");
  await page.getByTestId("description-input").fill("Dinner");
  await page.getByTestId("expense-quick-preview").waitFor({ timeout: 8000 });
  await expect(page.getByTestId("expense-quick-preview")).toContainText(/লাইভ ভাগ|Live split/);
  await expect(page.getByTestId("expense-quick-preview")).toContainText(/৳ ৬০০|৳ 600/);
  await page.getByTestId("expense-split-preview").waitFor({ timeout: 8000 });
  await expect(page.getByTestId("expense-split-preview")).toContainText(/প্রতি জনে|per person/);
  await page.getByTestId("expense-review-card").waitFor({ timeout: 8000 });
  await page.getByText(/প্রস্তুত|Ready/).waitFor({ timeout: 8000 });
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-add-expense.png"
  });
  await page.getByTestId("expense-review-card").scrollIntoViewIfNeeded();
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-add-expense-review.png"
  });
  await expect(page.getByRole("checkbox", { name: "Tanvir" }).getByRole("img")).toBeVisible({
    timeout: 8000
  });
  await expect(page.getByRole("checkbox", { name: "Rini" }).getByRole("img")).toBeVisible({
    timeout: 8000
  });

  await page.goto(`http://localhost:8090/group/${FLAT_ID}/settle`, { waitUntil: "networkidle" });
  await page.getByText("Dhanmondi Flat").waitFor({ timeout: 8000 });
  await page.getByText(/বিকাশে দাও|Pay with bKash/).waitFor({ timeout: 8000 });
  await expect(page.getByTestId("settle-flow-guide")).toContainText(
    /সেটেলমেন্ট কীভাবে হবে|How this settlement works/
  );
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-settle.png"
  });
  await page.getByTestId("settle-bkash-0").click();
  await expect(page.getByTestId("settle-notice")).toContainText(
    /নম্বর কপি হয়েছে|Number copied|ওয়ালেট খোলা হয়েছে|Wallet opened/
  );
  await page.getByTestId("settle-mark-paid-cta").waitFor({ timeout: 8000 });
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-settle-confirmation.png"
  });

  await page.goto("http://localhost:8090/groups/create", { waitUntil: "networkidle" });
  await page.getByText(/নতুন খাতা|New khata/).waitFor({ timeout: 8000 });
  await page.getByTestId("group-name-input").fill("Sajek Winter Trip");
  await page.getByRole("button", { name: /ট্রিপ|Trip/ }).click();
  await expect(page.getByTestId("group-create-preview-meta")).toContainText(
    /এরপর ডাকবে|Invite next/
  );
  await expect(page.getByTestId("create-group-footer-summary")).toContainText(/Sajek Winter Trip/);
  await expect(page.getByTestId("create-group-footer-summary")).toContainText(/ট্রিপ|Trip/);
  await expect(page.getByTestId("create-group-submit")).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-create-group.png"
  });

  await page.goto("http://localhost:8090/groups/join", { waitUntil: "networkidle" });
  await page.getByText(/খাতায় যোগ দাও|Join a khata/).waitFor({ timeout: 8000 });
  await page.getByTestId("join-code-input").fill("SAJEK1");
  await expect(page.getByTestId("join-code-preview")).toContainText("SAJEK1");
  await expect(page.getByTestId("join-code-status")).toContainText(/কোড প্রস্তুত|Code ready/);
  await expect(page.getByTestId("join-group-submit")).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-join-group.png"
  });

  await page.goto("http://localhost:8090/settings", { waitUntil: "networkidle" });
  await page.getByTestId("settings-profile-card").waitFor({ timeout: 8000 });
  await page.getByText(/ফোন ভেরিফাইড|Phone verified/).waitFor({ timeout: 8000 });
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-settings.png"
  });
  await expect(page.getByTestId("settings-notifications-row")).toBeVisible();
  await expect(page.getByTestId("settings-export-row")).toBeVisible();
  await expect(page.getByTestId("settings-privacy-row")).toBeVisible();
  await expect(page.getByTestId("settings-support-row")).toBeVisible();
  await expectSettingsNotice(page, "settings-notifications-row", /নোটিফিকেশন|Notifications/);
  await expectSettingsNotice(page, "settings-privacy-row", /প্রাইভেসি|Privacy/);

  await page.setViewportSize({ height: 667, width: 375 });

  await page.goto("http://localhost:8090/(tabs)", { waitUntil: "networkidle" });
  await page.getByText("Sajek Trip").waitFor({ timeout: 8000 });
  await page
    .getByText(/তুমি পাবে|You are owed/)
    .first()
    .waitFor({ timeout: 8000 });
  await expect(page.getByTestId("home-next-action")).toContainText(/পরের সেটেল|Next to settle/);
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-compact-home.png"
  });

  await page.goto("http://localhost:8090/balances", { waitUntil: "networkidle" });
  await page.getByTestId(`balances-group-row-${FLAT_ID}`).waitFor({ timeout: 8000 });
  await page
    .getByText(/তুমি দিবে|You owe/)
    .first()
    .waitFor({ timeout: 8000 });
  await expect(page.getByTestId("balances-person-queue")).toContainText(
    /কার সাথে কত|Who owes what/
  );
  await expect(page.getByTestId("balances-person-queue")).toContainText("Rini");
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-compact-balances.png"
  });

  await page.goto("http://localhost:8090/activity", { waitUntil: "networkidle" });
  await page.getByText("June rent").waitFor({ timeout: 8000 });
  await expect(page.getByTestId("activity-summary-card")).toContainText(/তুমি দিয়েছ|You paid/);
  await expect(page.getByTestId("activity-summary-card")).toContainText(
    /অন্যরা দিয়েছে|Others paid/
  );
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-compact-activity.png"
  });

  await page.goto(`http://localhost:8090/group/${SAJEK_ID}`, { waitUntil: "networkidle" });
  await page.getByText("Jeep fare").waitFor({ timeout: 8000 });
  await page.getByTestId("group-balance-action-card").waitFor({ timeout: 8000 });
  await page.getByTestId("group-members-strip").waitFor({ timeout: 8000 });
  await page.getByTestId("group-ledger-summary").waitFor({ timeout: 8000 });
  await expect(page.getByTestId("group-members-strip")).toContainText(/সদস্যরা|Members/);
  await expect(page.getByTestId("group-members-strip")).toContainText("Tanvir");
  await expect(page.getByTestId("group-members-strip")).toContainText("Rini");
  await expect(page.getByTestId("group-members-strip")).toContainText(/অ্যাডমিন|Admin/);
  await expect(page.getByTestId("group-members-strip")).toContainText(/সদস্য|Member/);
  await expect(page.getByTestId("group-ledger-summary")).toContainText(/মোট খরচ|Total spent/);
  await page
    .getByText(/পরের কাজ|Next up/)
    .first()
    .waitFor({ timeout: 8000 });
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-compact-group-detail.png"
  });

  await page.goto(`http://localhost:8090/group/${FLAT_ID}`, { waitUntil: "networkidle" });
  await page.getByText("June rent").waitFor({ timeout: 8000 });
  await page.getByTestId("group-people-balance-preview").waitFor({ timeout: 8000 });
  await expect(page.getByTestId("group-people-balance-preview")).toContainText(/সেটেল|Settle/);
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-compact-group-detail-debt.png"
  });

  await page.goto(`http://localhost:8090/group/${SAJEK_ID}/add-expense`, {
    waitUntil: "networkidle"
  });
  await page.getByText(/খাতা: Sajek Trip|With Sajek Trip/).waitFor({ timeout: 8000 });
  await page.getByTestId("amount-input").fill("1200");
  await page.getByTestId("description-input").fill("Dinner");
  await page.getByTestId("expense-quick-preview").waitFor({ timeout: 8000 });
  await expect(page.getByTestId("expense-quick-preview")).toContainText(/লাইভ ভাগ|Live split/);
  await expect(page.getByTestId("expense-quick-preview")).toContainText(/৳ ৬০০|৳ 600/);
  await page.getByTestId("expense-split-preview").waitFor({ timeout: 8000 });
  await expect(page.getByTestId("expense-split-preview")).toContainText(/প্রতি জনে|per person/);
  await page.getByTestId("expense-review-card").waitFor({ timeout: 8000 });
  await page.getByText(/প্রস্তুত|Ready/).waitFor({ timeout: 8000 });
  await expect(page.getByRole("checkbox", { name: "Tanvir" }).getByRole("img")).toBeVisible({
    timeout: 8000
  });
  await expect(page.getByRole("checkbox", { name: "Rini" }).getByRole("img")).toBeVisible({
    timeout: 8000
  });
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-compact-add-expense.png"
  });
  await page.getByTestId("expense-review-card").scrollIntoViewIfNeeded();
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-compact-add-expense-review.png"
  });

  await page.goto(`http://localhost:8090/group/${FLAT_ID}/settle`, { waitUntil: "networkidle" });
  await page.getByText("Dhanmondi Flat").waitFor({ timeout: 8000 });
  await page.getByText(/বিকাশে দাও|Pay with bKash/).waitFor({ timeout: 8000 });
  await expect(page.getByTestId("settle-flow-guide")).toContainText(
    /সেটেলমেন্ট কীভাবে হবে|How this settlement works/
  );
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-compact-settle.png"
  });

  await page.goto("http://localhost:8090/groups/create", { waitUntil: "networkidle" });
  await page.getByText(/নতুন খাতা|New khata/).waitFor({ timeout: 8000 });
  await page.getByTestId("group-name-input").fill("Sajek Winter Trip");
  await page.getByRole("button", { name: /ট্রিপ|Trip/ }).click();
  await expect(page.getByTestId("group-create-preview-meta")).toContainText(
    /এরপর ডাকবে|Invite next/
  );
  await expect(page.getByTestId("create-group-footer-summary")).toContainText(/Sajek Winter Trip/);
  await expect(page.getByTestId("create-group-footer-summary")).toContainText(/ট্রিপ|Trip/);
  await expect(page.getByTestId("create-group-submit")).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-compact-create-group.png"
  });

  await page.goto("http://localhost:8090/groups/join", { waitUntil: "networkidle" });
  await page.getByText(/খাতায় যোগ দাও|Join a khata/).waitFor({ timeout: 8000 });
  await page.getByTestId("join-code-input").fill("SAJEK1");
  await expect(page.getByTestId("join-code-preview")).toContainText("SAJEK1");
  await expect(page.getByTestId("join-code-status")).toContainText(/কোড প্রস্তুত|Code ready/);
  await expect(page.getByTestId("join-group-submit")).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-compact-join-group.png"
  });

  await page.goto("http://localhost:8090/settings", { waitUntil: "networkidle" });
  await page.getByTestId("settings-profile-card").waitFor({ timeout: 8000 });
  await page.getByText(/ফোন ভেরিফাইড|Phone verified/).waitFor({ timeout: 8000 });
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-compact-settings.png"
  });
});
