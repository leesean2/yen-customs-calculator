import { test, expect } from "@playwright/test";

/* ──────────────────────────────────────────────
   해외 vs 국내 가격 비교 탭 — 출발국 지원 E2E
   테스트 환율: 100엔 = 1,000원, 1달러 = 1,000원
   ────────────────────────────────────────────── */

import { openWithRates, rowValue } from "./helpers.js";

async function openCompare(page) {
  await openWithRates(page);
  await page.getByRole("button", { name: "국내비교" }).click();
}

const visibleOrigin = (page) => page.getByLabel("출발국").filter({ visible: true });

test("일본 기본 — 기존 라쿠텐 검색·링크와 판정이 그대로다", async ({ page }) => {
  await openCompare(page);
  await expect(page.getByText("일본 가격 (라쿠텐 · 아마존재팬)")).toBeVisible();
  await expect(page.getByRole("link", { name: /아마존재팬/ })).toBeVisible();

  // ¥15,100 + 배송 0 → 과세 28,388원 → 최종 179,388 vs 국내 200,000 → 직구 이득
  await page.getByLabel("일본 상품 가격").fill("15100");
  await page.getByLabel("국제 배송비").filter({ visible: true }).fill("0");
  await page.getByLabel("국내 구매가").fill("200000");
  await expect(page.getByText("직구 이득")).toBeVisible();
  await expect(rowValue(page, "🇯🇵 직구 최종가")).toHaveText("179,388원");
});

test("미국 출발 — 아마존·이베이 링크와 $200 면세한도로 계산한다", async ({ page }) => {
  await openCompare(page);
  await visibleOrigin(page).selectOption("US");
  await expect(page.getByText("미국 가격 (아마존 · 이베이)")).toBeVisible();

  // 검색어가 외부 링크에 물려 들어간다
  await page.getByPlaceholder(/아래 사이트에서 검색/).fill("switch oled");
  await expect(page.getByRole("link", { name: /아마존/ }).first())
    .toHaveAttribute("href", /amazon\.com\/s\?k=switch%20oled/);
  await expect(page.getByRole("link", { name: /이베이/ }))
    .toHaveAttribute("href", /ebay\.com/);

  // $250 > $200 → 과세: 관세 8% 20,000 + 부가세 27,000 = 47,000 → 최종 297,000
  await page.getByLabel("미국 상품 가격").fill("250");
  await page.getByLabel("국제 배송비").filter({ visible: true }).fill("0");
  await page.getByLabel("국내 구매가").fill("350000");
  await expect(page.getByText("직구 이득")).toBeVisible();
  await expect(rowValue(page, "🇺🇸 직구 최종가")).toHaveText("297,000원");
  await expect(page.getByText("BUY FROM US")).toBeVisible();

  // $199는 면세 → 최종 199,000
  await page.getByLabel("미국 상품 가격").fill("199");
  await expect(rowValue(page, "관부가세 (면세)")).toHaveText("0원");
  await expect(rowValue(page, "🇺🇸 직구 최종가")).toHaveText("199,000원");
});

test("중국 출발 — 타오바오·징둥 링크가 나오고 위안으로 표기한다", async ({ page }) => {
  await openCompare(page);
  await visibleOrigin(page).selectOption("CN");
  await expect(page.getByText("중국 가격 (타오바오 · 징둥)")).toBeVisible();
  await expect(page.getByRole("link", { name: /타오바오/ })).toBeVisible();
  await expect(page.getByLabel("중국 상품 가격")).toBeVisible();
});
