import { test, expect } from "@playwright/test";
import { openShop, fillRates } from "./helpers.js";

/* ──────────────────────────────────────────────
   결제 수단별 최종 비용 비교 E2E — 수수료가 외화 결제 금액에만 붙어
   수단별 총액이 갈리는지, 내 요율이 저장·복원되는지 검증한다.
   테스트 환율: 100엔 = 1,000원, 1달러 = 1,000원
   ────────────────────────────────────────────── */

test("기본 요율 — 신용카드 1.4% 수수료, 트래블카드가 최저", async ({ page }) => {
  await openShop(page); // 국제 배송비 0
  await page.getByLabel("상품 가격").fill("10000"); // ¥10,000 = 100,000원, 면세
  await page.getByRole("button", { name: "결제 수단별 최종 비용 비교" }).click();

  // 외화 결제 금액 100,000원: 신용 1.4% → 101,400 / 체크 0.7% → 100,700 / 트래블 0%
  await expect(page.getByRole("row", { name: /일반 신용카드/ })).toContainText("101,400원");
  await expect(page.getByRole("row", { name: /해외겸용 체크카드/ })).toContainText("100,700원");
  const travel = page.getByRole("row", { name: /트래블카드/ });
  await expect(travel).toContainText("100,000원");
  await expect(travel).toContainText("최저");
});

test("과세 주문 — 수수료는 세금·국제 배송비를 제외한 외화 금액에만 붙는다", async ({ page }) => {
  await openShop(page);
  await page.getByLabel("상품 가격").fill("20000"); // $200 과세 — 세금 37,600
  await page.getByLabel("국제 배송비").fill("10000");
  await page.getByRole("button", { name: "결제 수단별 최종 비용 비교" }).click();

  // 외화 금액 200,000원 × 1.4% = 2,800원 (배송비·세금 불포함)
  // 최종 = (200,000 + 10,000 + 39,480) + 2,800 = 252,280원
  const credit = page.getByRole("row", { name: /일반 신용카드/ });
  await expect(credit).toContainText("2,800원");
  await expect(credit).toContainText("252,280원");
});

test("내 요율 저장 — 수정하면 재계산되고 새로고침 후에도 유지, 기본값 복귀", async ({ page }) => {
  await openShop(page);
  await page.getByLabel("상품 가격").fill("10000");
  await page.getByRole("button", { name: "결제 수단별 최종 비용 비교" }).click();

  await page.getByLabel("일반 신용카드 수수료율").fill("2");
  await page.getByLabel("일반 신용카드 수수료율").blur();
  const credit = page.getByRole("row", { name: /일반 신용카드/ });
  await expect(credit).toContainText("내 요율");
  await expect(credit).toContainText("102,000원");

  // 새로고침 후에도 내 요율이 남는다
  await page.reload();
  await fillRates(page);
  await page.getByLabel("국제 배송비").fill("0");
  await page.getByLabel("상품 가격").fill("10000");
  await page.getByRole("button", { name: "결제 수단별 최종 비용 비교" }).click();
  await expect(page.getByLabel("일반 신용카드 수수료율")).toHaveValue("2");

  // 기본값으로 되돌리면 1.4%로 복귀
  await page.getByRole("button", { name: "기본값으로" }).click();
  await expect(page.getByLabel("일반 신용카드 수수료율")).toHaveValue("1.4");
  await expect(page.getByRole("row", { name: /일반 신용카드/ })).toContainText("101,400원");
});
