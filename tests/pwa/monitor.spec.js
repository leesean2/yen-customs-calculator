import { test, expect } from "@playwright/test";

/* 클라이언트 진단(monitor) — 프로덕션 빌드에서만 활성이라 PWA 스위트(vite preview)에서 검증한다.
   외부 환율 소스를 전부 막으면 폴백 체인이 끝까지 실패하고, monitor가 개인정보 없는
   진단 비콘(rate_all_failed + 실패 소스명)을 /api/log로 보내야 한다. */

test.beforeEach(async ({ page }) => {
  // 외부(환율 API 등) 전부 차단 → live-rate(preview SPA 폴백)·er-api·frankfurter 순차 실패
  await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
});

test("환율 소스가 전부 실패하면 진단 비콘(rate_all_failed)을 보낸다", async ({ page }) => {
  const beacons = [];
  await page.route("**/api/log", async (route) => {
    beacons.push(route.request().postData() || "");
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/");
  await expect(page.getByText("엔화 직구 · 여행 세금 계산기")).toBeVisible();

  await expect.poll(() => beacons.length, { timeout: 15_000 }).toBeGreaterThan(0);
  const body = beacons.join("\n");
  expect(body).toContain("rate_all_failed");
  // 개인/거래 데이터가 새지 않는지 — 실패 소스명만 담겨야 한다
  expect(body).toContain("frankfurter");
  expect(body).not.toContain("jpyKrw");
});
