import { test, expect } from "@playwright/test";

/* ──────────────────────────────────────────────
   환율 추이 차트 E2E — frankfurter 시계열을 모킹해
   최저·최고·현재 라벨, 호버 툴팁, 통화 전환 갱신을 검증한다.
   차트는 전역(환율 설정 아래 접이식)이라 어느 탭에서든 열 수 있고,
   통화·목표선은 알림 탭 설정을 따른다.

   모킹 시계열(원/1단위): JPY 9.2 → 9.8 → 9.5 (×100 표기: 920·980·950)
                        USD 1,350 → 1,420 → 1,400
   ────────────────────────────────────────────── */

import { blockExternal } from "./helpers.js";

async function openTrend(page) {
  await blockExternal(page);
  await page.route(/api\.frankfurter\.dev\/v1\/\d{4}-\d{2}-\d{2}\.\./, (r) => {
    const base = new URL(r.request().url()).searchParams.get("base");
    const rates = base === "JPY"
      ? { "2026-07-06": { KRW: 9.2 }, "2026-07-07": { KRW: 9.8 }, "2026-07-08": { KRW: 9.5 } }
      : { "2026-07-06": { KRW: 1350 }, "2026-07-07": { KRW: 1420 }, "2026-07-08": { KRW: 1400 } };
    r.fulfill({ json: { base, rates } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /환율 추이 차트 보기/ }).click();
}

test("R1. 엔 추이 — 최저·최고·현재가 100엔 기준으로 표시된다", async ({ page }) => {
  await openTrend(page);
  await expect(page.getByText("최저 920원")).toBeVisible();
  await expect(page.getByText("최고 980원")).toBeVisible();
  await expect(page.getByText(/현재\(일간\) 950원/)).toBeVisible();
  await expect(page.getByRole("img", { name: /환율 추이/ })).toBeVisible();

  // 1년 백분위 배지 — 모킹 분포 [920, 980, 950]에서 현재 950은 중간(하위 50%)
  await expect(page.getByText(/최근 1년 중 하위 50% — 중간 수준입니다/)).toBeVisible();

  // 호버 크로스헤어 툴팁 — 차트 중앙은 두 번째 포인트(7/7 · 980원)
  // hover()는 화면 밖 요소를 스크롤해 온 뒤 중앙에 포인터를 올린다
  await page.getByRole("img", { name: /환율 추이/ }).hover();
  await expect(page.getByText("7/7 · 980원")).toBeVisible();

  // 목표 환율(알림 탭 설정)을 입력하면 전역 차트에 기준선 라벨이 나타난다
  await page.getByRole("button", { name: "알림" }).click();
  await page.getByLabel("목표 환율").fill("950");
  await expect(page.getByText("목표 950", { exact: true })).toBeVisible();
  await page.getByLabel("목표 환율").fill("2000"); // 범위 밖 — 축을 짓누르지 않게 숨김
  await expect(page.getByText("목표 2,000", { exact: true })).toBeHidden();
});

test("R2. 알림 통화를 바꾸면 그 통화의 시계열로 갱신된다", async ({ page }) => {
  await openTrend(page);
  await expect(page.getByText("최고 980원")).toBeVisible();
  await page.getByRole("button", { name: "알림" }).click();
  await page.getByLabel("통화").selectOption("USD");
  await expect(page.getByText("(원/1달러 · ECB 일간)")).toBeVisible();
  await expect(page.getByText("최고 1,420원")).toBeVisible();
  await expect(page.getByText("최저 1,350원")).toBeVisible();
});

test("R3. 기간 토글(90일)로 다시 조회해도 정상 렌더링된다", async ({ page }) => {
  await openTrend(page);
  await page.getByRole("button", { name: "90일" }).click();
  await expect(page.getByText("최고 980원")).toBeVisible();
});

test("R4. 실시간 환율이 있으면 기준선·요약·백분위가 실시간 기준으로 나온다", async ({ page }) => {
  await blockExternal(page);
  await page.route(/api\.frankfurter\.dev\/v1\/\d{4}-\d{2}-\d{2}\.\./, (r) => {
    const base = new URL(r.request().url()).searchParams.get("base");
    r.fulfill({ json: { base, rates: { "2026-07-06": { KRW: 9.2 }, "2026-07-07": { KRW: 9.8 }, "2026-07-08": { KRW: 9.5 } } } });
  });
  // 실시간 시세: 100엔 = 940원 — 일간 마지막(950원)과 다른 값으로 구분 검증
  await page.route(/\/api\/live-rate/, (r) =>
    r.fulfill({ json: { jpyKrw: 9.4, usdKrw: 1000, krwPer: { JPY: 9.4, USD: 1000 }, source: "장중 모킹" } })
  );
  await page.goto("/");
  await page.getByRole("button", { name: /환율 추이 차트 보기/ }).click();

  // 요약 줄에 일간·실시간이 나란히, 차트 aria에도 실시간 포함
  await expect(page.getByText(/현재\(일간\) 950원/)).toBeVisible();
  await expect(page.getByText("실시간 940원")).toBeVisible();
  await expect(page.getByRole("img", { name: /실시간 940원/ })).toBeVisible();
  // 1년 백분위가 실시간 기준 — 분포 [920, 980, 950]에서 940은 하위 33%
  await expect(page.getByText(/최근 1년 중 하위 33% — 싼 편입니다/)).toBeVisible();
});

test("R5. 어느 탭에서든 보이고, 열림 상태는 새로고침 후에도 유지된다", async ({ page }) => {
  await openTrend(page); // 기본 탭(직구)에서 열었다
  await expect(page.getByText("최고 980원")).toBeVisible();
  await expect(page.getByLabel("상품 가격")).toBeVisible(); // 직구 탭 내용과 동시에 보인다

  // 다른 탭으로 옮겨도 차트는 그대로
  await page.getByRole("button", { name: "여행자" }).click();
  await expect(page.getByText("최고 980원")).toBeVisible();

  // 새로고침해도 접히지 않는다 (localStorage 유지)
  await page.reload();
  await expect(page.getByText("최고 980원")).toBeVisible();
  await expect(page.getByRole("button", { name: /환율 추이 차트 접기/ })).toBeVisible();

  // 접으면 차트가 사라진다
  await page.getByRole("button", { name: /환율 추이 차트 접기/ }).click();
  await expect(page.getByText("최고 980원")).toBeHidden();
});
