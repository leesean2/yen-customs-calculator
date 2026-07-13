import { test, expect } from "@playwright/test";
import { openWithRates } from "./helpers.js";

/* ──────────────────────────────────────────────
   해외 배송 통관조회 탭 E2E — /api/cargo-status를 모킹해 조회→단계 표시,
   다른 탭으로 이동해도 입력이 유지되는지, 오류 처리까지 검증한다
   (실 API 스키마는 배포 시 검증됨).
   ────────────────────────────────────────────── */

async function openTab(page) {
  await openWithRates(page);
  await page.getByRole("button", { name: "통관조회" }).click();
}

test("조회 — 화물관리번호로 진행 단계가 순서대로 표시된다", async ({ page }) => {
  await openTab(page);
  await page.route("**/api/cargo-status*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        configured: true, no: "20260713K1234567",
        info: { shipName: "테스트항공 KE001", cargoType: "특송화물", arrivedAt: "20260710" },
        steps: [
          { status: "입항적재화물목록제출", code: "01", date: "20260710" },
          { status: "수입신고수리", code: "05", date: "20260712" },
          { status: "반출", code: "07", date: "20260713" },
        ],
      }),
    })
  );

  await page.getByLabel("화물관리번호").fill("20260713K1234567");
  await page.getByRole("button", { name: "조회", exact: true }).click();

  await expect(page.getByText("테스트항공 KE001")).toBeVisible();
  await expect(page.getByText("입항적재화물목록제출")).toBeVisible();
  await expect(page.getByText("수입신고수리")).toBeVisible();
  await expect(page.getByText("반출")).toBeVisible();
});

test("다른 탭으로 이동했다 돌아와도 입력값이 유지된다", async ({ page }) => {
  await openTab(page);
  await page.getByLabel("화물관리번호").fill("20260713K1234567");

  await page.getByRole("button", { name: "여행자" }).click();
  await expect(page.getByLabel("화물관리번호")).toBeHidden();

  await page.getByRole("button", { name: "통관조회" }).click();
  await expect(page.getByLabel("화물관리번호")).toHaveValue("20260713K1234567");
});

test("입력 없이 조회하거나 서버 오류를 주면 인라인 안내로 처리된다", async ({ page }) => {
  await openTab(page);
  await page.getByRole("button", { name: "조회", exact: true }).click();
  await expect(page.getByText("화물관리번호를 입력해 주세요")).toBeVisible();

  await page.route("**/api/cargo-status*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ configured: true, no: "BAD", error: "조회 결과가 없습니다 — 화물관리번호를 확인하거나 아직 통관 정보가 등록되지 않았을 수 있습니다" }),
    })
  );
  await page.getByLabel("화물관리번호").fill("BAD");
  await page.getByRole("button", { name: "조회", exact: true }).click();
  await expect(page.getByText("조회 결과가 없습니다")).toBeVisible();
});

test("서버 키 미설정이면 안내 문구를 보여준다", async ({ page }) => {
  await openTab(page);
  await page.route("**/api/cargo-status*", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ configured: false }) })
  );
  await page.getByLabel("화물관리번호").fill("20260713K1234567");
  await page.getByRole("button", { name: "조회", exact: true }).click();
  await expect(page.getByText("서버에 통관조회 API 키")).toBeVisible();
});
