/**
 * E2E 공용 헬퍼 — 모든 스펙이 같은 결정적 셋업을 쓴다.
 * 테스트 환율: 100엔 = 1,000원(1엔 = 10원), 1달러 = 1,000원 → $환산 = ¥ ÷ 100
 * (파일명이 *.spec.js가 아니라 Playwright가 테스트로 수집하지 않는다)
 */

/** 외부 요청 전부 차단 — 환율 API 등 비결정 요소 제거. 특정 응답이 필요한
 *  스펙은 이 뒤에 page.route를 추가 등록하면 나중 등록이 우선 적용된다. */
export const blockExternal = (page) =>
  page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());

/** 고정 환율 수동 입력 */
export async function fillRates(page) {
  await page.getByLabel("JPY → KRW").fill("1000");
  await page.getByLabel("USD → KRW").fill("1000");
}

/** 홈 진입 + 고정 환율 — 대부분 스펙의 공통 시작점 */
export async function openWithRates(page) {
  await blockExternal(page);
  await page.goto("/");
  await fillRates(page);
}

/** 직구 탭 초기화 (기본 탭) — 국제 배송비까지 0으로 고정 */
export async function openShop(page) {
  await openWithRates(page);
  await page.getByLabel("국제 배송비").fill("0");
}

/** Row 컴포넌트의 값 스팬 — 라벨 스팬의 바로 다음 형제 */
export const rowValue = (page, label) =>
  page.getByText(label).locator("xpath=following-sibling::span[1]");
