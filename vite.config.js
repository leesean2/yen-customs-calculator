import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// package.json version을 클라이언트 진단(monitor)에 심어 로그에서 배포 버전을 구분한다
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)))

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  test: {
    // vitest — 순수 계산 로직 단위 테스트 (Playwright 스펙과 겹치지 않게 경로 한정)
    include: ['tests/unit/**/*.spec.js'],
    environment: 'node',
  },
})
