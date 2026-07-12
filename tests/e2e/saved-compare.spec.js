import { test, expect } from "@playwright/test";
import { openShop } from "./helpers.js";

/* ──────────────────────────────────────────────
   저장함 비교 보기 E2E — 각각 면세인 두 계산을 저장하고 비교를 열면
   따로/합산과세 세금 차이가 화면에 나오는지 검증한다.
   테스트 환율: 100엔 = 1,000원, 1달러 = 1,000원
   ────────────────────────────────────────────── */

test("각각 면세인 두 저장 계산 — 합산과세 시 세금 33,380원 경고", async ({ page }) => {
  await openShop(page); // 국제 배송비 0

  await page.getByLabel("상품 가격").fill("10000"); // $100 면세
  await page.getByLabel("저장 이름").fill("피규어");
  await page.getByRole("button", { name: "현재 계산 저장" }).click();

  await page.getByLabel("상품 가격").fill("6000"); // $60 면세
  await page.getByLabel("품목").first().selectOption("clothing");
  await page.getByLabel("저장 이름").fill("의류");
  await page.getByRole("button", { name: "현재 계산 저장" }).click();

  // 2건이 되면 비교 선택 안내와 체크박스가 나타난다
  await expect(page.getByText("체크로 2~3건을 고르면")).toBeVisible();
  await page.getByLabel("피규어 비교 선택").check();
  await page.getByLabel("의류 비교 선택").check();

  // 각각 면세, 따로 합계는 세금 0원
  await expect(page.getByText("따로 주문 합계")).toBeVisible();
  await expect(page.getByText("세금 0원 · 최종 160,000원")).toBeVisible();
  // 합산과세: 관세 15,800 + 부가세 17,580 = 33,380 → 최종 193,380
  await expect(page.getByText("세금 33,380원 · 최종 193,380원")).toBeVisible();
  await expect(page.getByText("합산과세로 세금이 33,380원 늘 수 있습니다")).toBeVisible();

  // 선택 해제하면 비교 블록이 닫힌다
  await page.getByLabel("의류 비교 선택").uncheck();
  await expect(page.getByText("따로 주문 합계")).toBeHidden();
});

test("이미 합산돼도 세금 차이가 없는 조합은 안심 문구를 보여준다", async ({ page }) => {
  await openShop(page);

  await page.getByLabel("상품 가격").fill("20000"); // $200 — 단독으로도 과세
  await page.getByLabel("저장 이름").fill("큰 주문");
  await page.getByRole("button", { name: "현재 계산 저장" }).click();

  await page.getByLabel("상품 가격").fill("30000"); // $300 — 과세
  await page.getByLabel("저장 이름").fill("더 큰 주문");
  await page.getByRole("button", { name: "현재 계산 저장" }).click();

  await page.getByLabel("큰 주문 비교 선택", { exact: true }).check();
  await page.getByLabel("더 큰 주문 비교 선택").check();
  // 둘 다 이미 전체 과세라 합쳐도 세액이 같다 (8% + 10% 동일 세율)
  await expect(page.getByText("합산과세돼도 세금 차이가 없습니다")).toBeVisible();
});
