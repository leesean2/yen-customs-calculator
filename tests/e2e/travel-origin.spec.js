import { test, expect } from "@playwright/test";
import { openWithRates, rowValue } from "./helpers.js";

/* ──────────────────────────────────────────────
   여행자 탭 출발국(여행국) 지원 E2E — 면세한도($800)는 나라와 무관하지만
   구매 금액 통화·환율이 여행국을 따라가는지 검증한다.
   테스트 환율: 100엔 = 1,000원, 1달러 = 1,000원
   ────────────────────────────────────────────── */

async function openTravel(page) {
  await openWithRates(page);
  await page.getByRole("button", { name: "여행자" }).click();
}

test("일본 기본 경로는 기존과 동일 — 엔 표기·100엔 환율 수식", async ({ page }) => {
  await openTravel(page);
  await page.getByLabel("일본에서 구매한 총 금액").fill("150000"); // $1,500 → 초과 $700
  await expect(rowValue(page, "면세한도 초과분")).toHaveText("700,000원");

  await page.getByRole("button", { name: "계산 근거 펼쳐보기" }).click();
  await expect(page.getByText("¥150,000 × 1,000원/100엔 = 1,500,000원")).toBeVisible();
});

test("미국 여행 — 달러 입력이 App 달러 환율로 환산되고 한도는 같은 $800", async ({ page }) => {
  await openTravel(page);
  // 여행자 탭 전용 라벨('여행국') — 직구 탭의 '출발국'과 겹치지 않는다.
  // 직구 소액면세 한도 표기도 숨긴다(여행자 한도 $800와 혼동 방지, showLimit=false)
  await expect(page.getByLabel("여행국")).not.toContainText("면세한도");
  await page.getByLabel("여행국").selectOption("US");
  const total = page.getByLabel("미국에서 구매한 총 금액");
  await expect(total).toBeVisible();

  await total.fill("900"); // $900 → 900,000원 → 초과 $100
  // 직구 탭(숨김)에도 판정 인장이 있어 보이는 쪽만 집는다
  await expect(page.getByLabel("과세 대상").filter({ visible: true })).toBeVisible();
  await expect(rowValue(page, "면세한도 초과분")).toHaveText("100,000원");
  // 단일간이세율 20% → 20,000 − 자진신고 30% 감면 6,000 = 14,000
  await expect(rowValue(page, "납부 예상 세액")).toHaveText("14,000원");

  await total.fill("800"); // 정확히 한도
  await expect(page.getByLabel("면세 대상").filter({ visible: true })).toBeVisible();
});
