import { test, expect } from "@playwright/test";
import { openShop, rowValue } from "./helpers.js";

/* ──────────────────────────────────────────────
   배대지 배송비 추정 E2E — 무게·치수 입력 → 대표 요율 추정 → 국제 배송비
   입력란 적용까지. 요율(data/shipping.js): 일본 첫 0.5kg 7,000 + 0.5kg당 1,200
   테스트 환율: 100엔 = 1,000원, 1달러 = 1,000원
   ────────────────────────────────────────────── */

test("무게 입력 → 추정치 적용 — 국제 배송비 입력란과 최종 비용에 반영된다", async ({ page }) => {
  await openShop(page); // 국제 배송비 0으로 시작
  await expect(rowValue(page, "최종 예상 비용")).toHaveText("150,000원"); // ¥15,000 면세

  await page.getByRole("button", { name: "무게로 배송비 추정" }).click();
  await page.getByLabel("실무게 kg").fill("1.2"); // 1.5kg 청구 → 7,000 + 2×1,200
  await expect(page.getByText("청구 무게")).toBeVisible();
  await page.getByRole("button", { name: "이 금액 적용" }).click();

  await expect(page.getByLabel("국제 배송비")).toHaveValue("9400");
  await expect(page.getByRole("button", { name: "✓ 적용됨" })).toBeVisible();
  // 면세 상태에서는 배송비만 더해진다
  await expect(rowValue(page, "최종 예상 비용")).toHaveText("159,400원");
});

test("부피무게가 실무게보다 크면 부피무게 기준으로 청구된다", async ({ page }) => {
  await openShop(page);
  await page.getByRole("button", { name: "무게로 배송비 추정" }).click();
  await page.getByLabel("실무게 kg").fill("1");
  await page.getByLabel("가로 cm").fill("30");
  await page.getByLabel("세로 cm").fill("40");
  await page.getByLabel("높이 cm").fill("20"); // 24,000÷6000 = 4kg > 1kg

  await expect(page.getByText("부피무게 4kg > 실무게 1kg")).toBeVisible();
  await page.getByRole("button", { name: "이 금액 적용" }).click();
  // 4kg = 0.5kg × 8단위 → 7,000 + 7×1,200 = 15,400
  await expect(page.getByLabel("국제 배송비")).toHaveValue("15400");
});

test("내 배대지 요율 — 저장하면 추정에 쓰이고 새로고침 후에도 유지, 해제 시 대표 요율 복귀", async ({ page }) => {
  await openShop(page);
  await page.getByRole("button", { name: "무게로 배송비 추정" }).click();
  await page.getByLabel("실무게 kg").fill("1.2"); // 1.5kg 청구 — 대표 요율이면 9,400

  await page.getByRole("button", { name: "내 배대지 요율 입력" }).click();
  await page.getByLabel("첫 0.5kg 요금").fill("6000");
  await page.getByLabel("추가 0.5kg당").fill("1000");
  await page.getByRole("button", { name: "요율 저장" }).click();
  await page.getByRole("button", { name: "이 금액 적용" }).click();
  await expect(page.getByLabel("국제 배송비")).toHaveValue("8000"); // 6,000 + 2×1,000

  // 새로고침 후에도 내 요율 유지 (localStorage) — 토글 라벨에 '내 요율' 표기
  await page.reload();
  await page.getByRole("button", { name: "무게로 배송비 추정 (배대지 내 요율)" }).click();
  await page.getByLabel("실무게 kg").fill("0.5");
  await page.getByRole("button", { name: "이 금액 적용" }).click();
  await expect(page.getByLabel("국제 배송비")).toHaveValue("6000");

  // 해제하면 대표 요율(첫 0.5kg 7,000)로 돌아온다
  await page.getByRole("button", { name: "대표 요율로" }).click();
  await page.getByRole("button", { name: "이 금액 적용" }).click();
  await expect(page.getByLabel("국제 배송비")).toHaveValue("7000");
});

test("출발국을 바꾸면 그 나라 요율로 추정된다 — 미국 첫 0.5kg 9,000원", async ({ page }) => {
  await openShop(page);
  await page.getByLabel("출발국").selectOption("US");
  await page.getByRole("button", { name: "무게로 배송비 추정" }).click();
  await page.getByLabel("실무게 kg").fill("0.5");
  await page.getByRole("button", { name: "이 금액 적용" }).click();
  await expect(page.getByLabel("국제 배송비")).toHaveValue("9000");
});
