const { test } = require("@playwright/test");

const PHONE = "+8801712345678";

test("capture Baki auth onboarding states", async ({ page }) => {
  await page.route("**/auth/v1/user**", (route) =>
    route.fulfill({
      body: JSON.stringify({ code: "not_authenticated" }),
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*"
      },
      status: 401
    })
  );

  await page.setViewportSize({ height: 932, width: 430 });

  await page.goto("http://localhost:8090/phone", { waitUntil: "networkidle" });
  await page.getByText(/ফোন নম্বর দাও|Enter your phone number/).waitFor({ timeout: 8000 });
  await page.getByTestId("auth-phone-input").fill("1712345678");
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-auth-phone.png"
  });

  await page.goto(`http://localhost:8090/otp?phone=${encodeURIComponent(PHONE)}`, {
    waitUntil: "networkidle"
  });
  await page.getByText(/OTP দিন|Enter OTP/).waitFor({ timeout: 8000 });
  await page.getByTestId("auth-otp-input").fill("123456");
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-auth-otp.png"
  });

  await page.goto(`http://localhost:8090/profile?phone=${encodeURIComponent(PHONE)}`, {
    waitUntil: "networkidle"
  });
  await page.getByText(/প্রোফাইল তৈরি করো|Create your profile/).waitFor({ timeout: 8000 });
  await page.getByTestId("auth-profile-name-input").fill("Tanvir");
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-populated-auth-profile.png"
  });

  await page.setViewportSize({ height: 667, width: 375 });

  await page.goto("http://localhost:8090/phone", { waitUntil: "networkidle" });
  await page.getByText(/ফোন নম্বর দাও|Enter your phone number/).waitFor({ timeout: 8000 });
  await page.getByTestId("auth-phone-input").fill("1712345678");
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-compact-auth-phone.png"
  });

  await page.goto(`http://localhost:8090/otp?phone=${encodeURIComponent(PHONE)}`, {
    waitUntil: "networkidle"
  });
  await page.getByText(/OTP দিন|Enter OTP/).waitFor({ timeout: 8000 });
  await page.getByTestId("auth-otp-input").fill("123456");
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-compact-auth-otp.png"
  });

  await page.goto(`http://localhost:8090/profile?phone=${encodeURIComponent(PHONE)}`, {
    waitUntil: "networkidle"
  });
  await page.getByText(/প্রোফাইল তৈরি করো|Create your profile/).waitFor({ timeout: 8000 });
  await page.getByTestId("auth-profile-name-input").fill("Tanvir");
  await page.screenshot({
    fullPage: true,
    path: "output/playwright/baki-compact-auth-profile.png"
  });
});
