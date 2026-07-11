import { test, expect } from "@playwright/test";

/* ──────────────────────────────────────────────
   출발국(다국가) 직구 E2E — 출발국별 통화 표기·면세한도·환율 소스가
   화면 결과까지 올바르게 이어지는지 검증한다.

   테스트 환율(수동 입력): 100엔 = 1,000원, 1달러 = 1,000원
   유로는 frankfurter 모킹: 1유로 = 1,400원
   ────────────────────────────────────────────── */

/** 직구 탭 초기화: 외부 요청 차단 → 환율 수동 입력 → 국제 배송비 0 */
async function openShop(page) {
  await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await page.goto("/");
  await page.getByLabel("JPY → KRW").fill("1000");
  await page.getByLabel("USD → KRW").fill("1000");
  await page.getByLabel("국제 배송비").fill("0");
}

/** frankfurter 최신 환율을 결정적 값으로 모킹 — 차단 라우트보다 나중에 등록해 우선 적용
 *  times를 주면 그 횟수만 응답하고 라우트가 내려가 이후 요청은 차단(실패)된다 */
async function mockFrankfurter(page, { base = "EUR", krw = 1400, date = "2026-07-10", times } = {}) {
  await page.route(
    new RegExp(`api\\.frankfurter\\.dev/v1/latest\\?base=${base}`),
    (r) => r.fulfill({ json: { base, date, rates: { KRW: krw } } }),
    times ? { times } : undefined
  );
}

const rowValue = (page, label) =>
  page.getByText(label).locator("xpath=following-sibling::span[1]");

test.describe("미국 출발 — 달러 표기 · 면세한도 $200 (한미 FTA)", () => {
  test("M1. $199는 면세, $201부터 전체 과세", async ({ page }) => {
    await openShop(page);
    await page.getByLabel("출발국").selectOption("US");
    await expect(page.getByText("적용 환율 1,000원/달러")).toBeVisible();
    await expect(page.getByLabel("미국 내 배송비")).toBeVisible();

    await page.getByLabel("상품 가격").fill("199");
    await expect(page.getByLabel("면세 대상")).toBeVisible();
    await expect(page.getByText("미화 200달러 이하 자가사용")).toBeVisible();
    await expect(rowValue(page, "최종 예상 비용")).toHaveText("199,000원");

    await page.getByLabel("상품 가격").fill("201");
    await expect(page.getByLabel("과세 대상")).toBeVisible();
    await expect(page.getByText("미화 200달러 초과")).toBeVisible();
    // 관세 8% 16,080 + 부가세 21,708 = 37,788 → 최종 201,000 + 37,788
    await expect(rowValue(page, "세금 합계")).toHaveText("37,788원");
    await expect(rowValue(page, "최종 예상 비용")).toHaveText("238,788원");
  });
});

test.describe("유럽 출발 — 유로 환율은 frankfurter(ECB)에서 별도 조회", () => {
  test("M2. €100 = 140,000원 = $140 → 면세, €110 = $154 → 과세", async ({ page }) => {
    await openShop(page);
    await mockFrankfurter(page); // 1유로 = 1,400원
    await page.getByLabel("출발국").selectOption("EU");
    await expect(page.getByText("적용 환율 1,400원/유로")).toBeVisible();

    await page.getByLabel("상품 가격").fill("100");
    await expect(page.getByLabel("면세 대상")).toBeVisible();
    await expect(page.getByText("≈ $140")).toBeVisible();
    await expect(rowValue(page, "최종 예상 비용")).toHaveText("140,000원");

    await page.getByLabel("상품 가격").fill("110");
    await expect(page.getByLabel("과세 대상")).toBeVisible();
    // 154,000원 과세: 관세 8% 12,320 + 부가세 16,632 = 28,952
    await expect(rowValue(page, "세금 합계")).toHaveText("28,952원");
    await expect(rowValue(page, "최종 예상 비용")).toHaveText("182,952원");
  });

  test("M3. 환율 조회 실패 시 오류 안내와 '다시 시도'가 뜬다", async ({ page }) => {
    await openShop(page); // 외부 요청 전부 차단 → frankfurter도 실패
    await page.getByLabel("출발국").selectOption("EU");
    await expect(page.getByText("환율을 불러오지 못했습니다")).toBeVisible();

    // 모킹을 등록한 뒤 다시 시도 → 정상 환율로 회복
    await mockFrankfurter(page);
    await page.getByRole("button", { name: "다시 시도" }).click();
    await expect(page.getByText("적용 환율 1,400원/유로")).toBeVisible();
  });
});

test.describe("출발국 공유 링크", () => {
  test("M4. o·r 파라미터로 유로 계산이 네트워크 없이 재현된다", async ({ page }) => {
    await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    await page.goto("/?p=100&l=0&i=0&c=hobby&j=1000&u=1000&o=EU&r=1400");

    await expect(page.getByText("공유된 환율 1,400원/유로 사용 중")).toBeVisible();
    await expect(page.getByLabel("출발국")).toHaveValue("EU");
    await expect(page.getByLabel("면세 대상")).toBeVisible();
    await expect(rowValue(page, "최종 예상 비용")).toHaveText("140,000원");
  });

  test("M5. 복사한 링크에 출발국이 담겨 왕복 재현된다", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openShop(page);
    await page.getByLabel("출발국").selectOption("US");
    await page.getByLabel("상품 가격").fill("199");

    await page.getByRole("button", { name: "이 계산 결과 링크 복사" }).click();
    const url = await page.evaluate(() => navigator.clipboard.readText());
    expect(url).toContain("o=US");
    expect(url).toContain("p=199");

    await page.goto(url);
    await expect(page.getByLabel("출발국")).toHaveValue("US");
    await expect(page.getByLabel("상품 가격")).toHaveValue("199");
    await expect(rowValue(page, "최종 예상 비용")).toHaveText("199,000원");
  });
});

test.describe("출발국 환율 폴백·가드", () => {
  test("M7. 조회 실패 시 마지막 성공 환율로 폴백하고 재시도를 제공한다", async ({ page }) => {
    await openShop(page);
    await mockFrankfurter(page, { times: 1 }); // 1회만 성공 — 이후 요청은 차단
    await page.getByLabel("출발국").selectOption("EU");
    await expect(page.getByText("적용 환율 1,400원/유로")).toBeVisible();

    // 재방문(라우트는 차단만 남음) — localStorage에 저장된 마지막 성공값으로 계산된다
    await page.reload();
    await page.getByLabel("JPY → KRW").fill("1000");
    await page.getByLabel("USD → KRW").fill("1000");
    await page.getByLabel("국제 배송비").fill("0");
    await page.getByLabel("출발국").selectOption("EU");
    await expect(page.getByText(/저장된 환율 1,400원\/유로.*최신 조회 실패/)).toBeVisible();
    await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();

    await page.getByLabel("상품 가격").fill("100");
    await expect(rowValue(page, "최종 예상 비용")).toHaveText("140,000원");
  });

  test("M8. 공유 링크의 r=0은 무시되어 0원 계산에 갇히지 않는다", async ({ page }) => {
    await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    await page.goto("/?p=100&l=0&i=0&c=hobby&j=1000&u=1000&o=EU&r=0");
    // 스냅샷 0이 적용됐다면 '공유된 환율 0원' — 대신 실시간 조회(실패) 경로로 가야 한다
    await expect(page.getByText(/공유된 환율/)).toBeHidden();
    await expect(page.getByText("환율을 불러오지 못했습니다")).toBeVisible();
  });

  test("M10. 실시간 환율 맵에 유로가 있으면 ECB 별도 조회 없이 우선 사용한다", async ({ page }) => {
    await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    // er-api만 열어 실시간 맵(krwPer)에 EUR을 공급 — frankfurter는 차단 상태 유지
    await page.route("**/open.er-api.com/**", (r) =>
      r.fulfill({ json: { result: "success", rates: { KRW: 1000, JPY: 100, EUR: 0.8, CNY: 5 } } })
    );
    await page.goto("/");
    await page.getByLabel("국제 배송비").fill("0");
    await page.getByLabel("출발국").selectOption("EU");
    await expect(page.getByText("적용 환율 1,250원/유로 — 실시간 환율")).toBeVisible();

    // €100 = 125,000원 = $125 ≤ $150 → 면세 (환율은 자동 반영된 1달러=1,000원)
    await page.getByLabel("상품 가격").fill("100");
    await expect(page.getByLabel("면세 대상")).toBeVisible();
    await expect(rowValue(page, "최종 예상 비용")).toHaveText("125,000원");
  });

  test("M9. 출발국을 바꾸면 공유 스냅샷을 버리고, 돌아와도 실시간 환율을 쓴다", async ({ page }) => {
    await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
    await mockFrankfurter(page); // 실시간 조회는 1,400원/유로
    await page.goto("/?p=100&l=0&i=0&c=hobby&j=1000&u=1000&o=EU&r=1500");
    await expect(page.getByText("공유된 환율 1,500원/유로 사용 중")).toBeVisible();

    await page.getByLabel("출발국").selectOption("JP");
    await page.getByLabel("출발국").selectOption("EU");
    await expect(page.getByText("적용 환율 1,400원/유로")).toBeVisible();
    await expect(page.getByText(/공유된 환율/)).toBeHidden();
  });
});

test.describe("구매 이력 — 출발국이 다르면 통화를 섞지 않는다", () => {
  test("M6. 일본 기록은 미국 주문의 합산과세에 포함되지 않는다", async ({ page }) => {
    await openShop(page);
    // 일본에서 ¥8,000 기록
    await page.getByLabel("판매자").fill("TestShop");
    await page.getByLabel("상품 가격").fill("8000");
    await page.getByRole("button", { name: "이 주문 기록" }).click();
    await expect(page.getByRole("button", { name: "✓ 기록됨" })).toBeVisible();

    // 미국 출발로 전환 — 같은 판매자여도 합산 경고가 뜨지 않아야 한다
    await page.getByLabel("출발국").selectOption("US");
    await page.getByLabel("상품 가격").fill("150");
    await expect(page.getByText(/주문한 기록/)).toBeHidden();

    // 미국 주문도 기록 → 이력에 두 통화가 각자 표기, 혼합 물품 합계는 숨김
    await page.getByRole("button", { name: "이 주문 기록" }).click();
    await expect(page.getByText("주문 2건")).toBeVisible();
    await expect(page.getByText("¥8,000")).toBeVisible();
    await expect(page.getByText("$150", { exact: true })).toBeVisible();
    await expect(page.getByText(/물품 [¥$€元]/)).toBeHidden();
  });
});
