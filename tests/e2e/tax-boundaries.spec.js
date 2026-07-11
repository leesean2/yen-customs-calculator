import { test, expect } from "@playwright/test";

/* ──────────────────────────────────────────────
   세금 로직 경계값 E2E — 계산이 틀리면 사용자가 실제로 세금을
   잘못 예상하게 되므로, 규정의 경계(면세 150달러 / 개소세 200만원 /
   합산과세 트리거)를 UI 입력 → 화면 결과까지 통으로 검증한다.

   테스트 환율(수동 입력): 100엔 = 1,000원(1엔 = 10원), 1달러 = 1,000원
   → 물품가격 달러 환산 = ¥ ÷ 100 (예: ¥15,000 = $150.00)
   외부 환율 API는 전부 차단해 결과를 결정적으로 만든다.
   ────────────────────────────────────────────── */

import { openShop, rowValue } from "./helpers.js";

const stampTaxed = (page) => page.getByLabel("과세 대상");
const stampFree = (page) => page.getByLabel("면세 대상");

test.describe("면세한도 USD 150 경계 — 물품가격 기준", () => {
  test("S1. $149.00 (¥14,900) — 면세, 세금 0원", async ({ page }) => {
    await openShop(page);
    await page.getByLabel("상품 가격").fill("14900");
    await expect(stampFree(page)).toBeVisible();
    await expect(page.getByText("≈ $149")).toBeVisible();
    await expect(page.getByText("관세·부가세가 면제됩니다")).toBeVisible();
    await expect(rowValue(page, "최종 예상 비용")).toHaveText("149,000원");
    await expect(page.getByText("세금 합계")).toBeHidden();
  });

  test("S2. 정확히 $150.00 (¥15,000) — 한도 '이하'는 면세", async ({ page }) => {
    await openShop(page);
    await page.getByLabel("상품 가격").fill("15000");
    await expect(stampFree(page)).toBeVisible();
    await expect(rowValue(page, "최종 예상 비용")).toHaveText("150,000원");
    await expect(page.getByText("세금 합계")).toBeHidden();
  });

  test("S3. $150.01 (¥15,001) — 한도 초과 즉시 '전체 금액' 과세", async ({ page }) => {
    await openShop(page);
    await page.getByLabel("상품 가격").fill("15001");
    await expect(stampTaxed(page)).toBeVisible();
    await expect(page.getByText("초과분이 아닌 전체 금액에 과세됩니다")).toBeVisible();
    // 취미용품 8%: 관세 12,000.8 + 부가세 16,201.08 = 28,201.88 → 반올림 표시
    await expect(rowValue(page, "세금 합계")).toHaveText("28,202원");
    await expect(rowValue(page, "최종 예상 비용")).toHaveText("178,212원");
  });

  test("S4. $151.00 (¥15,100) — 과세액 정확성 (관세 8% + 부가세 10%)", async ({ page }) => {
    await openShop(page);
    await page.getByLabel("상품 가격").fill("15100");
    await expect(stampTaxed(page)).toBeVisible();
    await expect(rowValue(page, "관세 (8%)")).toHaveText("12,080원");
    await expect(rowValue(page, "부가가치세 (10%)")).toHaveText("16,308원");
    await expect(rowValue(page, "세금 합계")).toHaveText("28,388원");
    await expect(rowValue(page, "최종 예상 비용")).toHaveText("179,388원");
  });

  test("S5. 국제 배송비는 면세 판정에서 제외 — ¥15,000 + ₩50,000 배송비도 면세", async ({ page }) => {
    await openShop(page);
    await page.getByLabel("상품 가격").fill("15000");
    await page.getByLabel("국제 배송비").fill("50000");
    await expect(stampFree(page)).toBeVisible();
    await expect(rowValue(page, "최종 예상 비용")).toHaveText("200,000원");
  });

  test("S6. 과세 시 국제 배송비는 과세가격에 포함 — ¥15,100 + ₩10,000", async ({ page }) => {
    await openShop(page);
    await page.getByLabel("상품 가격").fill("15100");
    await page.getByLabel("국제 배송비").fill("10000");
    // 과세가격 161,000 → 관세 12,880 + 부가세 17,388 = 30,268
    await expect(rowValue(page, "과세가격 (물품 + 국제운임)")).toHaveText("161,000원");
    await expect(rowValue(page, "세금 합계")).toHaveText("30,268원");
    // 최종가 = 상품 151,000 + 배송 10,000 + 세금 30,268
    await expect(rowValue(page, "최종 예상 비용")).toHaveText("191,268원");
  });

  test("S7. 일본 내 배송비는 면세 판정에 포함 — ¥14,000 + 현지 배송 ¥1,001 → 과세", async ({ page }) => {
    await openShop(page);
    await page.getByLabel("상품 가격").fill("14000");
    await page.getByLabel("일본 내 배송비").fill("1001");
    await expect(stampTaxed(page)).toBeVisible(); // 물품가격 ¥15,001 = $150.01
    await expect(page.getByText("≈ $150.01")).toBeVisible();
  });
});

test.describe("개별소비세 200만원 경계 — 가방·시계 (과세가격+관세 기준)", () => {
  test("S8. 기준 2원 미달 (¥185,185 → 1,999,998원) — 개소세 없음", async ({ page }) => {
    await openShop(page);
    await page.getByLabel("품목").selectOption("bag");
    await page.getByLabel("상품 가격").fill("185185");
    await expect(rowValue(page, "관세 (8%)")).toHaveText("148,148원");
    await expect(page.getByText("개별소비세 (200만원 초과분 20%)")).toBeHidden();
    await expect(page.getByText("교육세 (개소세의 30%)")).toBeHidden();
  });

  test("S9. 기준 8.8원 초과 (¥185,186 → 2,000,008.8원) — 개소세·교육세 발생", async ({ page }) => {
    await openShop(page);
    await page.getByLabel("품목").selectOption("bag");
    await page.getByLabel("상품 가격").fill("185186");
    await expect(page.getByText("개별소비세 (200만원 초과분 20%)")).toBeVisible();
    await expect(page.getByText("교육세 (개소세의 30%)")).toBeVisible();
  });

  test("S10. 초과분 계산 정확성 — 가방 ¥200,000", async ({ page }) => {
    await openShop(page);
    await page.getByLabel("품목").selectOption("bag");
    await page.getByLabel("상품 가격").fill("200000");
    // 과세가격 2,000,000 + 관세 160,000 = 2,160,000 → 초과분 160,000의 20%
    await expect(rowValue(page, "개별소비세 (200만원 초과분 20%)")).toHaveText("32,000원");
    await expect(rowValue(page, "교육세 (개소세의 30%)")).toHaveText("9,600원");
    await expect(rowValue(page, "부가가치세 (10%)")).toHaveText("220,160원");
    await expect(rowValue(page, "세금 합계")).toHaveText("421,760원");
    await expect(rowValue(page, "최종 예상 비용")).toHaveText("2,421,760원");
  });
});

test.describe("품목 특례", () => {
  test("S11. 목록통관 배제(건강기능식품) — $100이어도 과세", async ({ page }) => {
    await openShop(page);
    await page.getByLabel("품목").selectOption("health");
    await page.getByLabel("상품 가격").fill("10000");
    await expect(stampTaxed(page)).toBeVisible();
    await expect(page.getByText("금액과 무관하게 과세될 수 있습니다")).toBeVisible();
    await expect(rowValue(page, "세금 합계")).toHaveText("18,800원");
  });

  test("S12. 서적(관세 0% + 부가세 면제) — $200 과세 대상이지만 세액 0원", async ({ page }) => {
    await openShop(page);
    await page.getByLabel("품목").selectOption("book");
    await page.getByLabel("상품 가격").fill("20000");
    await expect(stampTaxed(page)).toBeVisible();
    await expect(rowValue(page, "부가가치세 (면제)")).toHaveText("0원");
    await expect(rowValue(page, "세금 합계")).toHaveText("0원");
    await expect(rowValue(page, "최종 예상 비용")).toHaveText("200,000원");
  });
});

test.describe("합산과세 — 같은 날 + 같은 판매자", () => {
  /** 판매자·가격을 입력하고 '이 주문 기록' 클릭 */
  async function recordOrder(page, seller, priceJpy) {
    await page.getByLabel("판매자").fill(seller);
    await page.getByLabel("상품 가격").fill(priceJpy);
    await page.getByRole("button", { name: "이 주문 기록" }).click();
    await expect(page.getByRole("button", { name: "✓ 기록됨" })).toBeVisible();
  }

  const combinedWarning = (page) => page.getByText(/오늘 .TestShop.에게 주문한 기록/);

  test("S13. 합산 정확히 $150은 경고만, $150.01부터 초과 판정", async ({ page }) => {
    await openShop(page);
    await recordOrder(page, "TestShop", "8000"); // $80 기록

    // 합산 $150.00 (8,000 + 7,000) — 경고는 뜨되 아직 한도 이내
    await page.getByLabel("상품 가격").fill("7000");
    await expect(combinedWarning(page)).toBeVisible();
    await expect(page.getByText("아직 면세한도(150달러) 이내")).toBeVisible();

    // 합산 $150.01 (8,000 + 7,001) — 전체 과세 위험 경고로 전환
    await page.getByLabel("상품 가격").fill("7001");
    await expect(page.getByText("면세한도(150달러)를 초과해 전체 금액에 세금이 붙을 수 있습니다")).toBeVisible();
    await expect(page.getByText("주문일을 나누는 것을 고려하세요")).toBeVisible();
  });

  test("S14. 트리거 조건 — 판매자 대소문자 무시, 다른 판매자는 미발동", async ({ page }) => {
    await openShop(page);
    await recordOrder(page, "TestShop", "8000");
    await page.getByLabel("상품 가격").fill("7001");

    // 소문자로 입력해도 같은 판매자로 인식
    await page.getByLabel("판매자").fill("testshop");
    await expect(page.getByText(/오늘 .testshop.에게 주문한 기록/)).toBeVisible();

    // 다른 판매자는 합산 경고 없음 (단품 $70.01은 면세)
    await page.getByLabel("판매자").fill("다른가게");
    await expect(page.getByText(/주문한 기록/)).toBeHidden();

    // 판매자를 지우면 경고 없음
    await page.getByLabel("판매자").fill("");
    await expect(page.getByText(/주문한 기록/)).toBeHidden();
  });
});
