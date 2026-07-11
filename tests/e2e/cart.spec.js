import { test, expect } from "@playwright/test";
import { openShop, rowValue } from "./helpers.js";

/* ──────────────────────────────────────────────
   장바구니(여러 상품 합산) E2E — 면세 판정은 주문 전체 기준이라
   각각 한도 이하인 상품도 합치면 과세되는 시나리오를 화면까지 검증한다.
   테스트 환율: 100엔 = 1,000원, 1달러 = 1,000원
   ────────────────────────────────────────────── */

test("각각 $150 이하인 두 상품 — 합산 $160으로 전체 과세, 품목별 관세", async ({ page }) => {
  await openShop(page);
  await page.getByLabel("상품 가격").fill("10000"); // $100 단독이면 면세
  await expect(page.getByLabel("면세 대상")).toBeVisible();

  await page.getByRole("button", { name: "상품 추가" }).click();
  await page.getByLabel("상품 2 가격").fill("6000"); // +$60 → 합산 $160
  await page.getByLabel("상품 2 품목").selectOption("clothing"); // 13%

  await expect(page.getByLabel("과세 대상")).toBeVisible();
  // 관세 100,000×8% + 60,000×13% = 15,800 · 부가세 17,580 → 세금 33,380 · 최종 193,380
  await expect(rowValue(page, "관세 (품목별 합산)")).toHaveText("15,800원");
  await expect(rowValue(page, "세금 합계")).toHaveText("33,380원");
  await expect(rowValue(page, "최종 예상 비용")).toHaveText("193,380원");

  // 계산 근거에 품목별 안분 수식이 보인다
  await page.getByRole("button", { name: "계산 근거 펼쳐보기" }).click();
  await expect(page.getByText("상품 2개 합계 ¥16,000")).toBeVisible();
  await expect(page.getByText("100,000원 × 8% + 60,000원 × 13% = 15,800원")).toBeVisible();

  // 상품 2를 삭제하면 다시 면세
  await page.getByRole("button", { name: "상품 2 삭제" }).click();
  await expect(page.getByLabel("면세 대상")).toBeVisible();
});

test("장바구니 공유 링크 — it 파라미터로 두 상품이 왕복 재현된다", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openShop(page);
  await page.getByLabel("상품 가격").fill("10000");
  await page.getByRole("button", { name: "상품 추가" }).click();
  await page.getByLabel("상품 2 가격").fill("6000");
  await page.getByLabel("상품 2 품목").selectOption("clothing");

  await page.getByRole("button", { name: "이 계산 결과 링크 복사" }).click();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toContain("it=");

  await page.goto(url);
  await expect(page.getByLabel("상품 가격")).toHaveValue("10000");
  await expect(page.getByLabel("상품 2 가격")).toHaveValue("6000");
  await expect(page.getByLabel("상품 2 품목")).toHaveValue("clothing");
  await expect(rowValue(page, "최종 예상 비용")).toHaveText("193,380원");
});
