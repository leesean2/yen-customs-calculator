import { test, expect } from "@playwright/test";

/* ──────────────────────────────────────────────
   관세청 과세환율 병기 E2E — 실제 세액 산정 기준인 주간 고시 과세환율을
   /api/customs-rate 모킹으로 주입해, 시장 환율 계산과의 병기 표시와
   면세 판정 괴리 경고를 검증한다.

   시장 환율: 100엔 = 1,000원(1엔 = 10원), 1달러 = 1,000원
   과세환율: 1엔 = 11원, 1달러 = 1,000원 → 같은 ¥라도 달러 환산이 10% 높다
   ────────────────────────────────────────────── */

import { blockExternal, fillRates } from "./helpers.js";

async function openShopWithCustomsRate(page) {
  await blockExternal(page);
  await page.route("**/api/customs-rate", (r) =>
    r.fulfill({
      json: {
        configured: true,
        source: "관세청 과세환율 (주간 고시)",
        appliedFrom: "2026-07-06",
        rates: { USD: 1000, JPY: 11, EUR: 1500, CNY: 200 },
      },
    })
  );
  await page.goto("/");
  await fillRates(page);
  await page.getByLabel("국제 배송비").fill("0");
}

test("C1. 과세환율 환산 금액이 고시 적용일과 함께 병기된다", async ({ page }) => {
  await openShopWithCustomsRate(page);
  await page.getByLabel("상품 가격").fill("10000"); // 시장 $100 · 과세환율 $110 — 둘 다 면세
  await expect(page.getByText(/과세환율 기준 ≈ 110,000원 · \$110 \(관세청 주간 고시 · 2026-07-06~\)/)).toBeVisible();
  await expect(page.getByText("실제 면세 판정이 여기 결과와 다를 수 있습니다")).toBeHidden();
});

test("C2. 과세환율로는 한도를 넘는 경계 금액이면 판정 괴리 경고가 뜬다", async ({ page }) => {
  await openShopWithCustomsRate(page);
  // 시장 환율로는 ¥15,000 = $150 → 면세, 과세환율로는 $165 → 초과
  await page.getByLabel("상품 가격").fill("15000");
  await expect(page.getByLabel("면세 대상")).toBeVisible();
  await expect(page.getByText(/과세환율 기준 ≈ 165,000원 · \$165/)).toBeVisible();
  await expect(page.getByText("실제 면세 판정이 여기 결과와 다를 수 있습니다")).toBeVisible();
});

test("C3. API 미구성(개발 환경 포함)이면 과세환율 줄이 없다", async ({ page }) => {
  await blockExternal(page);
  await page.goto("/"); // /api/customs-rate는 vite dev에서 HTML — 훅이 무시한다
  await page.getByLabel("JPY → KRW").fill("1000");
  await page.getByLabel("USD → KRW").fill("1000");
  await page.getByLabel("상품 가격").fill("15000");
  await expect(page.getByText(/과세환율 기준/)).toBeHidden();
});
