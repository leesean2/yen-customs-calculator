import { defineConfig } from "@playwright/test";

/* PWA 오프라인 검증 전용 config — 서비스워커는 프로덕션 빌드에서만 등록되므로
   dev 서버가 아닌 `vite preview`(실제 dist 결과물)를 상대로 테스트한다. */
export default defineConfig({
  testDir: "tests/pwa",
  timeout: 60_000,
  workers: 1, // 서비스워커/캐시 상태가 얽히지 않도록 직렬 실행
  use: {
    baseURL: "http://localhost:4173",
    serviceWorkers: "allow",
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
