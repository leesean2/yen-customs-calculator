import { test, expect } from "@playwright/test";

/* ──────────────────────────────────────────────
   다통화 목표 환율 알림 E2E — 실시간 환율 맵(krwPer)을 er-api 모킹으로 주입해
   엔 외 통화(달러·유로)의 목표 판정·표기 단위·통화 전환 동작을 검증한다.

   모킹 환율(er-api, USD 기준): KRW 1000, JPY 100, EUR 0.8, CNY 5
   → 1달러 = 1,000원 · 100엔 = 1,000원 · 1유로 = 1,250원 · 1위안 = 200원
   ────────────────────────────────────────────── */

async function openAlert(page) {
  await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await page.route("**/open.er-api.com/**", (r) =>
    r.fulfill({
      json: {
        result: "success",
        rates: { KRW: 1000, JPY: 100, EUR: 0.8, CNY: 5 },
        time_last_update_utc: "Fri, 10 Jul 2026 00:00:01 +0000",
      },
    })
  );
  await page.goto("/");
  await page.getByRole("button", { name: "알림" }).click();
}

test("W1. 통화를 달러로 바꾸면 1달러 기준으로 표기·판정한다", async ({ page }) => {
  await openAlert(page);
  await page.getByLabel("통화").selectOption("USD");
  await expect(page.getByText("현재 1달러 =")).toBeVisible();
  await expect(page.getByText("1,000.00원").first()).toBeVisible();

  // 목표 1,100원 이하 — 현재 1,000원이므로 활성화 즉시 도달
  await page.getByLabel("목표 환율").fill("1100");
  await page.getByLabel("알림 활성화").check();
  await expect(page.getByText(/🎯 목표 도달! 현재 1달러 = 1,000\.00원/)).toBeVisible();
  await expect(page.getByText(/🔔 목표 환율 도달 — 현재 1달러 = 1,000\.00원/)).toBeVisible();
});

test("W2. 유로 목표 — 미도달이면 배너가 없다가 조건을 바꾸면 도달한다", async ({ page }) => {
  await openAlert(page);
  await page.getByLabel("통화").selectOption("EUR");
  await expect(page.getByText("현재 1유로 =")).toBeVisible();

  // 1,250원인데 1,200원 '이하' 목표 → 미도달
  await page.getByLabel("목표 환율").fill("1200");
  await page.getByLabel("알림 활성화").check();
  await expect(page.getByText(/🎯 목표 도달!/)).toBeHidden();

  // '이상'으로 바꾸면 1,250 ≥ 1,200 → 도달
  await page.getByLabel("조건").selectOption("above");
  await expect(page.getByText(/🎯 목표 도달! 현재 1유로 = 1,250\.00원/)).toBeVisible();
});

test("W3. 통화를 바꾸면 목표가가 비워져 단위가 다른 오알림을 막는다", async ({ page }) => {
  await openAlert(page);
  await page.getByLabel("목표 환율").fill("950"); // 원/100엔 기준
  await page.getByLabel("통화").selectOption("CNY");
  await expect(page.getByLabel("목표 환율")).toHaveValue("");
  await expect(page.getByText("현재 1위안 =")).toBeVisible();
});
