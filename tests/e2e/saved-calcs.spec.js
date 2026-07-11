import { test, expect } from "@playwright/test";
import { openShop, rowValue } from "./helpers.js";

/* ──────────────────────────────────────────────
   계산 저장함 E2E — 저장 → (입력이 바뀐 뒤) 열기 → 저장 시점 스냅샷 복원.
   저장 본체는 공유 링크 쿼리라, 복원은 공유 링크 e2e와 같은 경로를 탄다.
   테스트 환율: 100엔 = 1,000원, 1달러 = 1,000원
   ────────────────────────────────────────────── */

test("저장 → 다른 입력으로 바꿔도 → 열기가 저장 시점 계산을 복원한다", async ({ page }) => {
  await openShop(page); // 기본 ¥15,000 · 국제 배송비 0 → 면세 150,000원
  await page.getByLabel("저장 이름").fill("피규어 예약분");
  await page.getByRole("button", { name: "현재 계산 저장" }).click();
  await expect(page.getByRole("button", { name: "✓ 저장됨" })).toBeVisible();
  await expect(page.getByText("피규어 예약분")).toBeVisible();

  // 입력을 완전히 바꾼다 — 과세 구간
  await page.getByLabel("상품 가격").fill("30000");
  await expect(page.getByLabel("과세 대상")).toBeVisible();

  await page.getByRole("button", { name: "열기" }).click();
  await expect(page.getByLabel("상품 가격")).toHaveValue("15000");
  await expect(page.getByLabel("면세 대상")).toBeVisible();
  await expect(rowValue(page, "최종 예상 비용")).toHaveText("150,000원");
  // 목록은 localStorage라 이동 후에도 남아 있다
  await expect(page.getByText("피규어 예약분")).toBeVisible();
});

test("이름을 비우면 날짜 기본 이름으로 저장되고, 삭제하면 목록에서 사라진다", async ({ page }) => {
  await openShop(page);
  await page.getByRole("button", { name: "현재 계산 저장" }).click();
  await expect(page.getByText(/직구 계산 \d{4}-\d{2}-\d{2}/)).toBeVisible();

  await page.getByRole("button", { name: /직구 계산 .* 삭제/ }).click();
  await expect(page.getByText(/직구 계산 \d{4}-\d{2}-\d{2}/)).toBeHidden();
  await expect(page.getByText("구매를 고민 중인 상품을 담아 두고")).toBeVisible();
});

test("저장함 JSON 백업 — 내보내기 → 저장소 초기화 → 가져오기로 복원된다", async ({ page }) => {
  await openShop(page);
  await page.getByLabel("저장 이름").fill("백업 테스트");
  await page.getByRole("button", { name: "현재 계산 저장" }).click();
  await expect(page.getByText("백업 테스트")).toBeVisible();

  const savedCard = page.locator("section", { hasText: "계산 저장함" });
  const downloadP = page.waitForEvent("download");
  await savedCard.getByRole("button", { name: "내보내기 (JSON)" }).click();
  const file = await (await downloadP).path();

  await page.evaluate(() => localStorage.removeItem("yen-calc:saved-calcs:v1"));
  await page.reload();
  await expect(page.getByText("백업 테스트")).toBeHidden();

  await page.getByLabel("계산 저장함 JSON 파일").setInputFiles(file);
  await expect(page.getByText("✓ 1건 가져옴", { exact: false })).toBeVisible();
  await expect(page.getByText("백업 테스트")).toBeVisible();
  // 복원된 항목이 실제로 열린다
  await page.getByRole("button", { name: "열기" }).click();
  await expect(rowValue(page, "최종 예상 비용")).toHaveText("150,000원");
});

test("장바구니·HS세율 스냅샷도 저장함으로 왕복된다", async ({ page }) => {
  await openShop(page);
  await page.getByLabel("상품 가격").fill("10000");
  await page.getByRole("button", { name: "상품 추가" }).click();
  await page.getByLabel("상품 2 가격").fill("6000");
  await page.getByLabel("상품 2 품목").selectOption("clothing");

  await page.getByRole("button", { name: "현재 계산 저장" }).click();
  await page.getByLabel("상품 가격").fill("500"); // 저장 뒤 입력 훼손
  await page.getByRole("button", { name: "상품 2 삭제" }).click();

  await page.getByRole("button", { name: "열기" }).click();
  await expect(page.getByLabel("상품 가격")).toHaveValue("10000");
  await expect(page.getByLabel("상품 2 가격")).toHaveValue("6000");
  await expect(rowValue(page, "최종 예상 비용")).toHaveText("193,380원");
});
