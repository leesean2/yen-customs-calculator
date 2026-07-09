import { test, expect } from "@playwright/test";

/* ──────────────────────────────────────────────
   직구 vs 여행 비교 탭 E2E — 같은 상품을 배송으로 받을 때(직구, 면세 $150)와
   직접 들고 올 때(여행, 면세 $800)의 세금·비용을 비교해 판정한다.
   면세한도 차이가 판정을 가르는 핵심이라 그 경계를 통으로 검증한다.

   테스트 환율: 100엔 = 1,000원(1엔 = 10원), 1달러 = 1,000원 → $환산 = ¥ ÷ 100
   ────────────────────────────────────────────── */

async function openRoute(page) {
  await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await page.goto("/");
  await page.getByLabel("JPY → KRW").fill("1000");
  await page.getByLabel("USD → KRW").fill("1000");
  await page.getByRole("button", { name: "직구·여행" }).click();
  await page.getByLabel("일본 상품 가격").fill("50000"); // 기본 $500
  await page.getByLabel("직구 시").fill("0");            // 국제배송비 0으로 고정
}

const rowValue = (page, label) =>
  page.getByText(label).locator("xpath=following-sibling::span[1]");

test("$500 상품 — 직구는 전체 과세, 여행은 면세 → 여행 유리", async ({ page }) => {
  await openRoute(page);
  // 직구($500 > $150): 물품 500,000 → 관세 8% 40,000 + 부가세 54,000 = 94,000, 최종 594,000
  // 여행($500 < $800): 면세, 최종 500,000
  await expect(page.getByText("여행 유리")).toBeVisible();
  await expect(rowValue(page, "🚚 직구 최종가")).toHaveText("594,000원");
  await expect(rowValue(page, "🧳 여행 반입 최종가")).toHaveText("500,000원");
});

test("$140 상품 — 양쪽 다 면세, 국제배송비 차이만큼 여행이 소폭 유리", async ({ page }) => {
  await openRoute(page);
  await page.getByLabel("일본 상품 가격").fill("14000"); // $140 < $150 < $800 → 둘 다 면세
  await page.getByLabel("직구 시").fill("30000");         // 직구 배송비 3만원
  // 직구 최종 170,000 (140,000 + 배송 30,000), 여행 최종 140,000
  await expect(rowValue(page, "🚚 직구 최종가")).toHaveText("170,000원");
  await expect(rowValue(page, "🧳 여행 반입 최종가")).toHaveText("140,000원");
});

test("주류·담배 — 여행 간이세율 미적용이라 비교 판정을 보류한다", async ({ page }) => {
  await openRoute(page);
  await page.getByLabel("여행 간이세율").selectOption("liquor");
  await expect(page.getByText("여행 유리")).toBeHidden();
  await expect(page.getByText("여행 반입 비용을 계산할 수 없습니다")).toBeVisible();
});
