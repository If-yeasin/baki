const { test } = require("@playwright/test");

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
    if (requestUrl.includes(`id=eq.${SAJEK_ID}`)) {
      return json(route, groups[0]);
    }
    return json(route, groups);
  });

  await page.route("**/rest/v1/group_members?**", (route) =>
    json(route, [
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
      }
    ])
  );

  await page.route("**/rest/v1/expenses?**", (route) => json(route, expenses));

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
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-home.png"
  });

  await page.goto("http://localhost:8090/balances", { waitUntil: "networkidle" });
  await page.getByText("Dhanmondi Flat").waitFor({ timeout: 8000 });
  await page
    .getByText(/তুমি দিবে|You owe/)
    .first()
    .waitFor({ timeout: 8000 });
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-balances.png"
  });

  await page.goto("http://localhost:8090/activity", { waitUntil: "networkidle" });
  await page.getByText("Sajek Trip").waitFor({ timeout: 8000 });
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-activity.png"
  });

  await page.goto(`http://localhost:8090/group/${SAJEK_ID}`, { waitUntil: "networkidle" });
  await page.getByText("Jeep fare").waitFor({ timeout: 8000 });
  await page
    .getByText(/তুমি পাবে|You are owed/)
    .first()
    .waitFor({ timeout: 8000 });
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-group-detail.png"
  });
});
