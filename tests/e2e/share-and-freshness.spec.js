import { test, expect } from "@playwright/test";

/* 세율 데이터 신선도 배너 · 계산 결과 URL 공유 · 월간 지출 요약 E2E
   (환율 셋업은 다른 스펙과 동일: 100엔 = 1,000원, 1달러 = 1,000원) */

import { blockExternal, openShop } from "./helpers.js";

const STALE_BANNER = /세율이 최신인지 확인이 필요합니다/;

test.describe("세율 데이터 신선도 배너", () => {
  test("기준일 90일 이내에는 배너가 없다", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-08-01T12:00:00") }); // 기준일 +24일
    await blockExternal(page);
    await page.goto("/");
    await expect(page.getByText("엔화 직구 · 여행 세금 계산기")).toBeVisible();
    await expect(page.getByText(STALE_BANNER)).toBeHidden();
  });

  test("기준일에서 90일이 지나면 확인 배너가 뜬다", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-11-15T12:00:00") }); // 기준일 +130일
    await blockExternal(page);
    await page.goto("/");
    await expect(page.getByText(STALE_BANNER)).toBeVisible();
    await expect(page.getByText(/기준일\(2026-07-08\)/)).toBeVisible();
    await expect(page.getByRole("link", { name: "관세청 고시" })).toBeVisible();
  });
});

test.describe("계산 결과 URL 공유", () => {
  test("공유 링크로 열면 입력값·환율·결과가 그대로 재현된다", async ({ page }) => {
    await blockExternal(page);
    await page.goto("/?p=15100&l=0&i=0&c=hobby&j=1000&u=1000");

    await expect(page.getByLabel("상품 가격")).toHaveValue("15100");
    await expect(page.getByLabel("국제 배송비")).toHaveValue("0");
    await expect(page.getByLabel("JPY → KRW")).toHaveValue("1000");
    // 공유된 환율은 실시간 값이 덮어쓰지 않도록 수동 입력 취급
    await expect(page.getByText("직접 입력한 환율 사용 중")).toBeVisible();
    // 같은 계산 결과: $151 과세, 최종 179,388원
    await expect(page.getByLabel("과세 대상")).toBeVisible();
    await expect(page.getByText("179,388원")).toBeVisible();
  });

  test("링크 복사 버튼이 현재 입력값을 담은 URL을 클립보드에 넣는다", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openShop(page);
    await page.getByLabel("상품 가격").fill("15100");
    await page.getByLabel("품목").selectOption("bag");

    await page.getByRole("button", { name: "이 계산 결과 링크 복사" }).click();
    await expect(page.getByRole("button", { name: "✓ 링크 복사됨" })).toBeVisible();

    const url = await page.evaluate(() => navigator.clipboard.readText());
    expect(url).toContain("p=15100");
    expect(url).toContain("c=bag");
    expect(url).toContain("j=1000");
    expect(url).toContain("u=1000");

    // 복사된 링크를 실제로 열어 같은 결과가 나오는지 왕복 검증
    await page.goto(url);
    await expect(page.getByLabel("상품 가격")).toHaveValue("15100");
    await expect(page.getByLabel("품목")).toHaveValue("bag");
  });
});

test.describe("이번 달 지출 요약", () => {
  test("주문을 기록하면 건수·물품가·예상 세금이 합산된다", async ({ page }) => {
    await openShop(page);
    await page.getByLabel("판매자").fill("TestShop");

    // 과세 주문 ¥15,100 (세금 28,388원) 기록
    await page.getByLabel("상품 가격").fill("15100");
    await page.getByRole("button", { name: "이 주문 기록" }).click();
    await expect(page.getByText("주문 1건")).toBeVisible();
    await expect(page.getByText("¥15,100").last()).toBeVisible();
    await expect(page.getByText("예상 세금")).toBeVisible();
    await expect(page.getByText("28,388원").last()).toBeVisible();

    // 면세 주문 ¥8,000 (세금 0원) 추가 — 건수·물품가만 늘고 세금은 그대로
    await page.getByLabel("상품 가격").fill("8000");
    await page.getByRole("button", { name: "이 주문 기록" }).click();
    await expect(page.getByText("주문 2건")).toBeVisible();
    // 합산과세 경고에도 같은 금액이 나오므로 요약 카드의 <b>만 exact로 짚는다
    await expect(page.getByText("¥23,100", { exact: true })).toBeVisible();
  });
});
