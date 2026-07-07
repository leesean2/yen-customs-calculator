# 엔화 직구 · 여행 세금 계산기

일본 직구 관부가세와 여행자 휴대품 세금을 실시간 환율로 계산하는 React(Vite) 앱.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ 생성
```

## 환율 API

`src/hooks/useExchangeRates.js`
- 기본: `open.er-api.com` (키 불필요, CORS 허용, 일 1회 갱신)
- 폴백: `api.frankfurter.dev` (ECB 고시환율)
- localStorage 1시간 캐시 → 재방문 시 즉시 표시 후 백그라운드 갱신
- 두 소스 모두 실패 시 캐시 사용, 캐시도 없으면 수동 입력 안내
- 사용자가 환율을 직접 수정하면 override 모드로 전환, "실시간 환율로 되돌리기" 제공

## 계산 로직 (2026-07 기준, 참고용)

- 일본발 직구 소액면세: 물품가격(상품가+현지 배송비) USD 150 이하 → 면세, 초과 시 **전체 금액** 과세
- 과세가격 = 물품가격 + 국제운임 / 관세 = 과세가격 × 품목별 관세율 / 부가세 = (과세가격+관세) × 10%
- 가방·시계: (과세가격+관세) 200만원 초과분 개별소비세 20% + 교육세(개소세의 30%)
- 건강기능식품: 목록통관 배제 → 금액 무관 과세 가능 경고
- 여행자: USD 800 면세, 초과분 간이세율 20% 가정, 자진신고 시 30% 감면(한도 20만원)

세율/한도 상수는 `src/data/categories.js`에서 수정.

## Vercel 배포

```bash
npm i -g vercel && vercel
```
또는 GitHub 푸시 후 Vercel 대시보드에서 Import — Vite 프리셋 자동 인식 (Build: `vite build`, Output: `dist`).
