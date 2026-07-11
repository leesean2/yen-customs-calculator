import { test, expect } from "@playwright/test";
import { openShop, rowValue } from "./helpers.js";

/* ──────────────────────────────────────────────
   HS부호 정확 관세율 E2E — /api/tariff-rate를 모킹해 조회→적용→계산 반영→
   공유 링크 왕복까지 화면 흐름을 검증한다 (실 API 스키마는 배포 시 검증됨).
   테스트 환율: 100엔 = 1,000원, 1달러 = 1,000원
   ────────────────────────────────────────────── */

// 노트북(8471.30) — 기본 8%지만 WTO협정 0%가 적용되는 실제 사례를 본뜬 응답
const mockTariff = (page) =>
  page.route("**/api/tariff-rate*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        configured: true, hs: "8471300000", base: 8, wto: 0, applied: 0,
        appliedName: "WTO협정세율",
        ftaMin: null,
      }),
    })
  );

test("조회 → 적용 — 품목 대푯값(8%) 대신 HS 세율(0%)로 관세가 계산된다", async ({ page }) => {
  await openShop(page);
  await mockTariff(page);
  await page.getByLabel("상품 가격").fill("20000"); // $200 → 과세, hobby 8%면 관세 16,000
  await expect(rowValue(page, "관세 (8%)")).toHaveText("16,000원");

  await page.getByRole("button", { name: "HS부호로 정확 관세율 적용" }).click();
  await page.getByLabel("HS부호").fill("8471300000");
  await page.getByRole("button", { name: "세율 조회" }).click();
  await expect(page.getByText("기본세율 8% · WTO협정 0%")).toBeVisible();

  await page.getByRole("button", { name: "이 세율 적용" }).click();
  await expect(page.getByText("HS 8471300000 관세율 0% 적용 중")).toBeVisible();
  // 관세 0% → 부가세만: 200,000 × 10% = 20,000
  await expect(rowValue(page, "관세 (0%)")).toHaveText("0원");
  await expect(rowValue(page, "세금 합계")).toHaveText("20,000원");

  // 해제하면 대푯값으로 복귀
  await page.getByRole("button", { name: "해제" }).click();
  await expect(rowValue(page, "관세 (8%)")).toHaveText("16,000원");
});

test("적용된 HS 세율이 공유 링크로 왕복 재현된다", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openShop(page);
  await mockTariff(page);
  await page.getByLabel("상품 가격").fill("20000");
  await page.getByRole("button", { name: "HS부호로 정확 관세율 적용" }).click();
  await page.getByLabel("HS부호").fill("8471300000");
  await page.getByRole("button", { name: "세율 조회" }).click();
  await page.getByRole("button", { name: "이 세율 적용" }).click();

  await page.getByRole("button", { name: "이 계산 결과 링크 복사" }).click();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toContain("it=20000%3Ahobby%3A8471300000%3A0"); // "가격:품목:hs:세율" 인코딩

  await page.goto(url);
  await expect(page.getByText("HS 8471300000 관세율 0% 적용 중")).toBeVisible();
  await expect(rowValue(page, "세금 합계")).toHaveText("20,000원");
});

test("잘못된 부호·API 오류는 인라인 안내로 처리된다", async ({ page }) => {
  await openShop(page);
  await page.getByRole("button", { name: "HS부호로 정확 관세율 적용" }).click();

  // 10자리가 아니면 조회 전에 막는다
  await page.getByLabel("HS부호").fill("12345");
  await page.getByRole("button", { name: "세율 조회" }).click();
  await expect(page.getByText("HS부호는 숫자 10자리입니다")).toBeVisible();

  // 서버가 오류 문구를 주면 그대로 보여준다
  await page.route("**/api/tariff-rate*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ configured: true, hs: "1234567890", error: "해당 HS부호의 관세율이 없습니다 — 10자리 부호를 확인하세요" }),
    })
  );
  await page.getByLabel("HS부호").fill("1234567890");
  await page.getByRole("button", { name: "세율 조회" }).click();
  await expect(page.getByText("해당 HS부호의 관세율이 없습니다")).toBeVisible();
});
