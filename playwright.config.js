import { defineConfig } from "@playwright/test";

/* E2E — vite dev 서버로 앱을 띄워 브라우저에서 세금 계산 경계값을 검증한다.
   서버리스 API는 필요 없다(테스트가 외부 요청을 전부 차단하고 환율을 수동 입력). */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:5173",
  },
  webServer: {
    command: "npm run dev -- --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
