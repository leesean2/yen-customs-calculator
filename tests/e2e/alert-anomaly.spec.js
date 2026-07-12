import { test, expect } from "@playwright/test";
import { blockExternal } from "./helpers.js";

/* ──────────────────────────────────────────────
   환율 이상 감지 다통화 E2E — 교차 검증 소스 3곳 + 수출입은행 + 장중 소스를
   모킹해, 알림 통화를 따라 소스 행·표기 단위·내 은행 환율 비교가 바뀌는지 검증.
   이상 감지는 전역 패널(환율 설정 아래 접이식 — 추이 차트와 함께)에 있다.

   모킹 환율(1단위당 원): JPY 10 · USD 1,000 · EUR 1,250 · CNY 200
   frankfurter +0.5% · currency-api -0.5% · 수출입은행 -0.2% → 최대 편차 0.5% (정상)
   ────────────────────────────────────────────── */

const KRW = { JPY: 10, USD: 1000, EUR: 1250, CNY: 200 };

async function openAnomaly(page) {
  await blockExternal(page);

  // er-api — 앱 상단 환율(latest/USD의 USD 기준 맵)과 이상 감지(rates.KRW) 겸용
  await page.route(/open\.er-api\.com\/v6\/latest\/(\w+)/, (r) => {
    const cur = new URL(r.request().url()).pathname.split("/").pop();
    const rates = cur === "USD"
      ? { KRW: 1000, JPY: 100, EUR: 0.8, CNY: 5 }
      : { KRW: KRW[cur] };
    r.fulfill({ json: { result: "success", rates, time_last_update_utc: "Fri, 10 Jul 2026 00:00:01 +0000" } });
  });

  // frankfurter latest — 이상 감지 두 번째 소스 (+0.5%)
  await page.route(/api\.frankfurter\.dev\/v1\/latest/, (r) => {
    const base = new URL(r.request().url()).searchParams.get("base");
    r.fulfill({ json: { base, rates: { KRW: KRW[base] * 1.005 } } });
  });

  // currency-api (jsDelivr) — 세 번째 소스 (-0.5%)
  await page.route(/currency-api.*\/currencies\/(\w+)\.json/, (r) => {
    const lc = /(\w+)\.json/.exec(r.request().url())[1];
    r.fulfill({ json: { [lc]: { krw: KRW[lc.toUpperCase()] * 0.995 } } });
  });

  // 수출입은행 고시 프록시 — 통화 쿼리대로 응답 (-0.2%)
  await page.route(/\/api\/bank-rate/, (r) => {
    const cur = new URL(r.request().url()).searchParams.get("cur") ?? "JPY";
    r.fulfill({ json: {
      configured: true, source: "한국수출입은행 고시 (매매기준율)",
      date: "2026-07-10", currency: cur, krw: KRW[cur] * 0.998,
    } });
  });

  // 장중 소스 — krwPer 맵
  await page.route(/\/api\/live-rate/, (r) =>
    r.fulfill({ json: { jpyKrw: 10, usdKrw: 1000, krwPer: KRW, source: "장중 모킹" } })
  );

  await page.goto("/");
  // 이상 감지는 전역 패널 — 토글을 열면 마운트되며 조회가 시작된다
  await page.getByRole("button", { name: /환율 추이 · 이상 감지 보기/ }).click();
}

test("N1. 기본(엔) — 소스 행이 100엔 기준으로 나오고 최대 편차 0.5%는 정상", async ({ page }) => {
  await openAnomaly(page);
  await expect(page.getByText("환율 이상 감지 (엔화)")).toBeVisible();
  await expect(page.getByText("시장 기준 (중앙값 · 소스 3곳)")).toBeVisible();
  // 중앙값 10원/엔 → 100엔 기준 1000.00원 (fmtRate는 천 단위 구분 없음)
  await expect(page.getByText("1000.00원").first()).toBeVisible();
  await expect(page.getByText("한국수출입은행 고시 (매매기준율)")).toBeVisible();
  await expect(page.getByText("998.00원")).toBeVisible(); // 은행 -0.2%
  await expect(page.getByText(/✓ 정상 — 소스 간 최대 편차 0\.50%/)).toBeVisible();

  // 1엔 기준 입력(9원 = -10%)은 자동 인식 후 환산해 비정상 판정
  await page.getByLabel("내 은행/앱에 표시된 환율 (선택)").fill("9");
  await expect(page.getByText("1엔 기준 환율로 보여 100엔당 900.00원으로 환산해 비교했습니다.")).toBeVisible();
  await expect(page.getByText(/🚨 시장 기준 대비 -10\.00%/)).toBeVisible();
});

test("N2. 통화를 달러로 바꾸면 소스·은행 고시·내 환율 비교가 1달러 기준으로 재조회된다", async ({ page }) => {
  await openAnomaly(page);
  await page.getByLabel("내 은행/앱에 표시된 환율 (선택)").fill("950"); // 엔 기준 입력

  // 통화 선택은 알림 탭 설정 — 바꾸면 전역 이상 감지도 따라간다
  await page.getByRole("button", { name: "알림" }).click();
  await page.getByLabel("통화").selectOption("USD");
  await expect(page.getByText("환율 이상 감지 (달러화)")).toBeVisible();
  // 통화 전환 시 단위가 다른 입력은 비워진다
  await expect(page.getByLabel("내 은행/앱에 표시된 환율 (선택)")).toHaveValue("");

  // 중앙값 1달러 = 1000.00원, 은행 고시도 달러(-0.2% → 998원)로 재조회
  await expect(page.getByText("시장 기준 (중앙값 · 소스 3곳)")).toBeVisible();
  await expect(page.getByText("1000.00원").first()).toBeVisible();
  await expect(page.getByText("998.00원")).toBeVisible();
  await expect(page.getByText(/✓ 정상 — 소스 간 최대 편차 0\.50%/)).toBeVisible();

  // 1달러 기준 입력 그대로 비교 (자동 환산 없음) — -3%는 비정상 경고
  await page.getByLabel("내 은행/앱에 표시된 환율 (선택)").fill("970");
  await expect(page.getByText(/🚨 시장 기준 대비 -3\.00%/)).toBeVisible();
  await expect(page.getByText(/1달러 기준 환율을 입력하면/)).toBeVisible();
});
