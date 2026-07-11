import { test, expect } from "@playwright/test";

/* 구매 이력 내보내기/가져오기 E2E — 기록 → JSON 다운로드 → 저장소 초기화 →
   같은 파일 가져오기로 이력이 복원되는 왕복을 검증한다.
   (계산 저장함 카드에도 같은 백업 버튼이 있어 구매 이력 카드로 스코프한다) */

import { openWithRates as openShop } from "./helpers.js";

const historyCard = (page) => page.locator("section", { hasText: "구매 이력" });

test("내보낸 JSON을 가져오면 이력이 복원된다", async ({ page }) => {
  await openShop(page);
  const card = historyCard(page);

  // 주문 기록
  await page.getByLabel("판매자").fill("TestShop");
  await page.getByLabel("상품 가격").fill("8000");
  await page.getByRole("button", { name: "이 주문 기록" }).click();
  await expect(page.getByText("(1건 · 최근 60일)")).toBeVisible();

  // 내보내기 — 다운로드 파일 확보
  const downloadP = page.waitForEvent("download");
  await card.getByRole("button", { name: "내보내기 (JSON)" }).click();
  const file = await (await downloadP).path();

  // 저장소 초기화 후 새로고침 → 이력 없음
  await page.evaluate(() => localStorage.removeItem("yen-calc:orders:v1"));
  await page.reload();
  await expect(page.getByText("(0건 · 최근 60일)")).toBeVisible();

  // 가져오기 → 복원 확인
  await page.getByLabel("구매 이력 JSON 파일").setInputFiles(file);
  await expect(page.getByText("✓ 1건 가져옴", { exact: false })).toBeVisible();
  await expect(page.getByText("(1건 · 최근 60일)")).toBeVisible();
  await expect(page.getByText("TestShop")).toBeVisible();

  // 같은 파일을 또 가져오면 중복이라 0건 추가
  await page.getByLabel("구매 이력 JSON 파일").setInputFiles(file);
  await expect(page.getByText("✓ 0건 가져옴", { exact: false })).toBeVisible();
});

test("형식이 잘못된 파일은 오류 안내를 보여준다", async ({ page }) => {
  await openShop(page);
  await page.getByLabel("구매 이력 JSON 파일").setInputFiles({
    name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{ not json"),
  });
  await expect(page.getByText("가져오기 실패")).toBeVisible();
});
