import { test, expect } from "@playwright/test";

/* ──────────────────────────────────────────────
   여행자 별도 면세 품목(술·담배·향수) E2E
   — 기본 $800 한도와 별개인 면세 조건 판정과 주류 세액(관세·주세·
   교육세·부가세·자진신고 감면) 계산을 화면 결과까지 검증한다.

   테스트 환율: 100엔 = 1,000원, 1달러 = 1,000원 (¥40,000 = $400)
   ────────────────────────────────────────────── */

async function openTravel(page) {
  await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await page.goto("/");
  await page.getByLabel("JPY → KRW").fill("1000");
  await page.getByLabel("USD → KRW").fill("1000");
  await page.getByRole("button", { name: "여행자" }).click();
}

const rowValue = (page, label) =>
  page.getByText(label).locator("xpath=following-sibling::span[1]");

test.describe("술 — 2병·2L·$400 세 조건 모두 충족해야 면세", () => {
  test("A1. 정확히 2병·2L·$400 경계는 면세", async ({ page }) => {
    await openTravel(page);
    await page.getByLabel("술 병수").fill("2");
    await page.getByLabel("술 총 용량").fill("2");
    await page.getByLabel("술 총 금액").fill("40000"); // $400
    await expect(page.getByText("면세 범위 이내")).toBeVisible();
    await expect(page.getByText("술 납부 예상 세액")).toBeHidden();
  });

  test("A2. 병수 초과 시 전체 과세 — 위스키 세목별 세액", async ({ page }) => {
    await openTravel(page);
    await page.getByLabel("술 병수").fill("3");
    await page.getByLabel("술 총 용량").fill("2");
    await page.getByLabel("술 총 금액").fill("40000"); // 400,000원
    await expect(page.getByText(/면세 범위 초과\(2병 초과\)/)).toBeVisible();
    // 관세 20% 80,000 → 주세 72%(과세가격+관세) 345,600 → 교육세 30% 103,680
    // → 부가세 10% 92,928 → 자진신고 감면(관세의 30%) −24,000 = 598,208원
    await expect(rowValue(page, "관세 (20%)")).toHaveText("80,000원");
    await expect(rowValue(page, "주세 (72%)")).toHaveText("345,600원");
    await expect(rowValue(page, "교육세 (주세의 30%)")).toHaveText("103,680원");
    await expect(rowValue(page, "부가가치세 (10%)")).toHaveText("92,928원");
    await expect(rowValue(page, "자진신고 감면 (관세의 30%)")).toHaveText("−24,000원");
    await expect(rowValue(page, "술 납부 예상 세액")).toHaveText("598,208원");

    // 자진신고 해제 → 감면 행이 사라지고 세액이 감면 전으로
    await page.getByLabel("세관에 자진신고").uncheck();
    await expect(page.getByText("자진신고 감면 (관세의 30%)")).toBeHidden();
    await expect(rowValue(page, "술 납부 예상 세액")).toHaveText("622,208원");
  });

  test("A3. 맥주는 종량 주세(리터당) — 용량 초과 과세", async ({ page }) => {
    await openTravel(page);
    await page.getByLabel("주종").selectOption("beer");
    await page.getByLabel("술 총 용량").fill("3"); // 2L 초과
    await page.getByLabel("술 총 금액").fill("3000"); // 30,000원
    await expect(page.getByText(/면세 범위 초과\(2L 초과\)/)).toBeVisible();
    // 관세 30% 9,000 · 주세 3L×885.7 = 2,657 · 교육세 797 · 부가세 4,245 · 감면 −2,700
    await expect(rowValue(page, "관세 (30%)")).toHaveText("9,000원");
    await expect(rowValue(page, "주세 (종량 885.7원/L)")).toHaveText("2,657원");
    await expect(rowValue(page, "술 납부 예상 세액")).toHaveText("14,000원");
  });

  test("A4. 금액 초과($401)도 단독으로 전체 과세를 만든다", async ({ page }) => {
    await openTravel(page);
    await page.getByLabel("술 병수").fill("1");
    await page.getByLabel("술 총 용량").fill("1");
    await page.getByLabel("술 총 금액").fill("40100"); // $401
    await expect(page.getByText(/면세 범위 초과\(\$400 초과\)/)).toBeVisible();
  });
});

test.describe("담배·향수 — 수량 한도 판정", () => {
  test("A5. 담배 200개비까지 면세, 201개비부터 신고 안내", async ({ page }) => {
    await openTravel(page);
    await page.getByLabel("담배 (궐련)").fill("200");
    await expect(page.getByText("200개비까지 면세")).toBeVisible();
    await page.getByLabel("담배 (궐련)").fill("201");
    await expect(page.getByText(/200개비 초과 — 초과분은 담배소비세/)).toBeVisible();
  });

  test("A6. 향수 100mL까지 면세, 초과 시 전체 과세 안내", async ({ page }) => {
    await openTravel(page);
    await page.getByLabel("향수 용량").fill("100");
    await expect(page.getByText("100mL까지 면세")).toBeVisible();
    await page.getByLabel("향수 용량").fill("101");
    await expect(page.getByText(/100mL 초과 — 향수 전체가 과세 대상/)).toBeVisible();
  });
});
