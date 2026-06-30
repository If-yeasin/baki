const { expect, test } = require("@playwright/test");

const USER_ID = "11111111-1111-4111-8111-111111111111";
const EMPTY_GROUP_ID = "88888888-8888-4888-8888-888888888888";

const emptyGroup = {
  archived_at: null,
  avatar_url: null,
  created_at: "2026-06-30T08:00:00.000Z",
  created_by: USER_ID,
  deleted_at: null,
  id: EMPTY_GROUP_ID,
  invite_code: "fresh1",
  name: "Fresh Khata",
  template: "mess",
  updated_at: "2026-06-30T08:00:00.000Z"
};

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

async function installSession(page) {
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
          confirmed_at: "2026-06-30T08:00:00.000Z",
          created_at: "2026-06-30T08:00:00.000Z",
          id: userId,
          phone: "+8801700000001",
          role: "authenticated",
          updated_at: "2026-06-30T08:00:00.000Z",
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
}

async function installApiRoutes(page) {
  await page.route("**/auth/v1/user**", (route) =>
    json(route, {
      app_metadata: { provider: "phone", providers: ["phone"] },
      aud: "authenticated",
      confirmed_at: "2026-06-30T08:00:00.000Z",
      created_at: "2026-06-30T08:00:00.000Z",
      id: USER_ID,
      phone: "+8801700000001",
      role: "authenticated",
      updated_at: "2026-06-30T08:00:00.000Z",
      user_metadata: {}
    })
  );

  await page.route("**/rest/v1/groups?**", (route) => {
    const requestUrl = decodeURIComponent(route.request().url());
    if (requestUrl.includes(`id=eq.${EMPTY_GROUP_ID}`)) {
      return json(route, emptyGroup);
    }
    return json(route, []);
  });

  await page.route("**/rest/v1/group_members?**", (route) =>
    json(route, [
      {
        group_id: EMPTY_GROUP_ID,
        joined_at: "2026-06-30T08:00:00.000Z",
        left_at: null,
        profiles: { display_name: "Tanvir" },
        role: "admin",
        user_id: USER_ID
      }
    ])
  );

  await page.route("**/rest/v1/expenses?**", (route) => json(route, []));
  await page.route("**/rest/v1/profiles?**", (route) =>
    json(route, [
      {
        bkash_number: "+8801700000001",
        display_name: "Tanvir",
        id: USER_ID,
        nagad_number: "+8801900000001",
        phone: "+8801700000001"
      }
    ])
  );
  await page.route("**/rest/v1/rpc/get_group_balances**", (route) => json(route, []));
}

async function captureEmptyStates(page, prefix) {
  await page.goto("http://localhost:8090/(tabs)", { waitUntil: "networkidle" });
  await page.getByTestId("groups-empty-state").waitFor({ timeout: 8000 });
  await page.screenshot({
    fullPage: true,
    path: `output/playwright/baki-${prefix}-empty-home.png`
  });

  await page.goto("http://localhost:8090/balances", { waitUntil: "networkidle" });
  await page.getByTestId("balances-empty-state").waitFor({ timeout: 8000 });
  await page.screenshot({
    fullPage: true,
    path: `output/playwright/baki-${prefix}-empty-balances.png`
  });

  await page.goto("http://localhost:8090/activity", { waitUntil: "networkidle" });
  await page.getByTestId("activity-empty-state").waitFor({ timeout: 8000 });
  await page.screenshot({
    fullPage: true,
    path: `output/playwright/baki-${prefix}-empty-activity.png`
  });

  await page.goto(`http://localhost:8090/group/${EMPTY_GROUP_ID}`, { waitUntil: "networkidle" });
  await page.getByTestId("group-expenses-empty-state").waitFor({ timeout: 8000 });
  await page.getByTestId("group-members-strip").waitFor({ timeout: 8000 });
  await expect(page.getByTestId("group-members-strip")).toContainText(/সদস্যরা|Members/);
  await expect(page.getByTestId("group-members-strip")).toContainText("Tanvir");
  await expect(page.getByTestId("group-members-strip")).toContainText(/অ্যাডমিন|Admin/);
  await expect(page.getByTestId("new-group-starter-card")).toContainText(
    /খাতা প্রস্তুত|Khata is ready/
  );
  await expect(page.getByTestId("new-group-starter-card")).toContainText("FRESH1");
  await page.screenshot({
    fullPage: true,
    path: `output/playwright/baki-${prefix}-empty-group-detail.png`
  });

  await page.goto(`http://localhost:8090/group/${EMPTY_GROUP_ID}/settle`, {
    waitUntil: "networkidle"
  });
  await page.getByTestId("settle-empty-state").waitFor({ timeout: 8000 });
  await page.screenshot({
    fullPage: true,
    path: `output/playwright/baki-${prefix}-empty-settle.png`
  });
}

test("capture Baki empty states", async ({ page }) => {
  await installSession(page);
  await installApiRoutes(page);

  await page.setViewportSize({ height: 932, width: 430 });
  await captureEmptyStates(page, "populated");

  await page.setViewportSize({ height: 667, width: 375 });
  await captureEmptyStates(page, "compact");
});
