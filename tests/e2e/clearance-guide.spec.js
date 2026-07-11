import { test, expect } from "@playwright/test";
import { openShop } from "./helpers.js";

/* ──────────────────────────────────────────────
   통관 절차 안내 E2E — 결과 판정에 따라 목록통관/일반 수입신고 안내가
   바뀌고, 과세 시 예상 세액이 납부 단계에 그대로 들어가는지 확인한다.
   테스트 환율: 100엔 = 1,000원, 1달러 = 1,000원
   ────────────────────────────────────────────── */

test("면세 결과 — 목록통관 안내, 세액 납부 단계 없음", async ({ page }) => {
  await openShop(page); // 기본 ¥15,000 = $150 면세
  await page.getByRole("button", { name: "통관 절차 안내 — 목록통관" }).click();
  await expect(page.getByText("수입신고 생략")).toBeVisible();
  await expect(page.getByText("개인통관고유부호 준비")).toBeVisible();
  await expect(page.getByText("세액 고지 · 납부")).toBeHidden();
});

test("과세 결과 — 일반 수입신고 안내에 예상 세액이 들어간다", async ({ page }) => {
  await openShop(page);
  await page.getByLabel("상품 가격").fill("15001"); // $150.01 → 과세
  await page.getByRole("button", { name: "통관 절차 안내 — 일반 수입신고" }).click();
  // 관세 12,000.8 + 부가세 16,201.08 = 28,201.88 → 28,202원
  await expect(page.getByText("예상 세액 28,202원")).toBeVisible();
  await expect(page.getByText("150달러를 넘어 수입신고 대상")).toBeVisible();
});

test("목록통관 배제 품목 — 신고 사유가 금액이 아닌 품목으로 안내된다", async ({ page }) => {
  await openShop(page);
  await page.getByLabel("상품 가격").fill("100"); // $1이어도 배제 품목은 과세
  await page.getByLabel("품목").first().selectOption("health");
  await page.getByRole("button", { name: "통관 절차 안내 — 일반 수입신고" }).click();
  await expect(page.getByText("목록통관 배제 품목(건강기능식품 등)이 있어")).toBeVisible();
});
