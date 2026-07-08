import { test, expect } from "@playwright/test";

/* '계산 근거 펼쳐보기' 토글 — 결과 카드의 수식이 실제 입력값·세액과
   일치하는지 검증한다. (환율 셋업은 tax-boundaries.spec.js와 동일:
   100엔 = 1,000원, 1달러 = 1,000원 → $환산 = ¥ ÷ 100) */

async function openShop(page) {
  await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await page.goto("/");
  await page.getByLabel("JPY → KRW").fill("1000");
  await page.getByLabel("USD → KRW").fill("1000");
  await page.getByLabel("국제 배송비").fill("0");
}

const toggle = (page) => page.getByRole("button", { name: "계산 근거 펼쳐보기" });

test("면세 케이스 — 환산·판정 수식이 입력값 그대로 대입되어 보인다", async ({ page }) => {
  await openShop(page);
  await page.getByLabel("상품 가격").fill("14900");

  // 접힌 상태에서는 수식이 없다
  await expect(page.getByText("면세한도 $150 → 면세")).toBeHidden();

  await toggle(page).click();
  await expect(page.getByText("상품 ¥14,900 + 일본 내 배송·수수료 ¥0 = ¥14,900")).toBeVisible();
  await expect(page.getByText("¥14,900 × 1,000원/100엔 = 149,000원")).toBeVisible();
  await expect(page.getByText("149,000원 ÷ 1,000원/$1 = $149")).toBeVisible();
  await expect(page.getByText("$149 ≤ 면세한도 $150 → 면세")).toBeVisible();
  await expect(page.getByText("물품 149,000원 + 국제 배송 0원 + 세금 0원 = 149,000원")).toBeVisible();

  // 다시 접기
  await page.getByRole("button", { name: "계산 근거 접기" }).click();
  await expect(page.getByText("면세한도 $150 → 면세")).toBeHidden();
});

test("과세 케이스(가방 ¥200,000) — 개소세·부가세 수식까지 세액과 일치", async ({ page }) => {
  await openShop(page);
  await page.getByLabel("품목").selectOption("bag");
  await page.getByLabel("상품 가격").fill("200000");
  await toggle(page).click();

  await expect(page.getByText("$2,000 > 면세한도 $150 → 전체 금액 과세")).toBeVisible();
  await expect(page.getByText("물품 2,000,000원 + 국제운임 0원 = 2,000,000원")).toBeVisible();
  await expect(page.getByText("2,000,000원 × 8% = 160,000원")).toBeVisible();
  await expect(page.getByText("(과세가격+관세 2,160,000원 − 기준 2,000,000원) × 20% = 32,000원")).toBeVisible();
  await expect(page.getByText("32,000원 × 30% = 9,600원")).toBeVisible();
  await expect(page.getByText("(과세가격 2,000,000원 + 관세 160,000원 + 개소세 32,000원 + 교육세 9,600원) × 10% = 220,160원")).toBeVisible();
  await expect(page.getByText("관세 160,000원 + 개소세 32,000원 + 교육세 9,600원 + 부가세 220,160원 = 421,760원")).toBeVisible();
  await expect(page.getByText("물품 2,000,000원 + 국제 배송 0원 + 세금 421,760원 = 2,421,760원")).toBeVisible();
});

test("여행자 탭 — 초과분 과세 수식과 자진신고 감면이 보인다", async ({ page }) => {
  await openShop(page);
  await page.getByRole("button", { name: "여행자" }).click();
  await page.getByLabel("일본에서 구매한 총 금액").fill("150000"); // 1,500,000원 = $1,500

  await page.getByRole("button", { name: "계산 근거 펼쳐보기" }).click();
  await expect(page.getByText("¥150,000 × 1,000원/100엔 = 1,500,000원")).toBeVisible();
  await expect(page.getByText("$800 × 1,000원/$1 = 800,000원")).toBeVisible();
  await expect(page.getByText("1,500,000원 − 면세한도 800,000원 = 초과분 700,000원 → 과세")).toBeVisible();
  await expect(page.getByText("초과분 700,000원 × 20% = 140,000원")).toBeVisible();
  await expect(page.getByText("min(세액 140,000원 × 30%, 상한 200,000원) = −42,000원")).toBeVisible();
  await expect(page.getByText("140,000원 − 감면 42,000원 = 98,000원")).toBeVisible();
});
