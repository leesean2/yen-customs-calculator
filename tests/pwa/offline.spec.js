import { test, expect } from "@playwright/test";

/* 서비스워커 오프라인 동작 검증 (프로덕션 빌드 + vite preview)
   특히 "첫 방문 직후 오프라인 → 빈 화면" 라이프사이클 함정을 잡는다.
   외부 환율 API는 차단해 오프라인 상황을 결정적으로 만든다. */

const APP_TITLE = "엔화 직구 · 여행 세금 계산기";

async function waitForActiveController(page) {
  // 서비스워커가 설치·활성화되어 페이지를 제어(controller)할 때까지 대기
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return !!reg && !!reg.active && navigator.serviceWorker.controller != null;
  }, null, { timeout: 30_000 });
}

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
});

test("서비스워커가 등록·활성화되어 페이지를 제어한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(APP_TITLE)).toBeVisible();
  await waitForActiveController(page);
  const scope = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg?.scope;
  });
  expect(scope).toContain("localhost:4173");
});

test("첫 방문 직후 오프라인으로 새로고침해도 앱이 렌더된다", async ({ page, context }) => {
  // 1) 첫 온라인 방문 — 이때 SW가 install 시점에 앱 셸+자산을 프리캐시해야 한다
  await page.goto("/");
  await expect(page.getByText(APP_TITLE)).toBeVisible();
  await waitForActiveController(page);

  // 2) 네트워크를 끊고 새로고침 — 프리캐시가 없으면 여기서 JS를 못 받아 빈 화면이 된다
  await context.setOffline(true);
  await page.reload();

  // 3) 오프라인에서도 앱 셸과 계산 UI가 그대로 떠야 한다
  await expect(page.getByText(APP_TITLE)).toBeVisible();
  await expect(page.getByLabel("상품 가격")).toBeVisible();
  await expect(page.getByRole("button", { name: "직구", exact: true })).toBeVisible();

  // 앱 셸만 뜨고 JS가 죽은 게 아니라 React가 캐시에서 마운트되어 반응하는지 확인:
  // 환율이 없는 오프라인이라 일반 품목은 면세지만, 목록통관 배제 품목(건기식)은
  // 환율과 무관하게 과세로 즉시 뒤집혀야 한다 → 계산 로직이 살아있다는 증거
  await expect(page.getByLabel("면세 대상")).toBeVisible();
  await page.getByLabel("품목").selectOption("health");
  await expect(page.getByLabel("과세 대상")).toBeVisible();

  await context.setOffline(false);
});
