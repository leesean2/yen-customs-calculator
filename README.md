# 엔화 직구 · 여행 세금 계산기

일본 직구 관부가세와 여행자 휴대품 세금을 실시간 환율로 계산하고, 일본(라쿠텐) vs 국내(네이버쇼핑) 가격을 비교하는 React(Vite) 앱.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173 (검색 API 제외한 화면만)
vercel dev       # 검색 API(api/) 포함 로컬 실행
npm run build    # dist/ 생성
```

## 가격 비교 (일본 vs 국내)

"가격 비교" 탭에서 라쿠텐·네이버쇼핑 검색 결과 또는 직접 입력한 가격으로,
직구 최종가(상품가 환산 + 국제 배송비 + 관부가세)와 국내 구매가를 비교해
어느 쪽이 이득인지 판정한다(차이 3% 미만은 "비슷함"). 아마존재팬은 공개 API가 없어 수동 입력.

검색 API는 `api/`의 Vercel 서버리스 함수가 중계하며, 환경변수가 없으면 수동 입력 모드로 동작:

| 환경변수 | 발급처 | 용도 |
| --- | --- | --- |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | [developers.naver.com](https://developers.naver.com/apps/) → 애플리케이션 등록 → "검색" API 선택 | 네이버쇼핑 상품 검색 |
| `RAKUTEN_APP_ID` | [webservice.rakuten.co.jp](https://webservice.rakuten.co.jp/) → 앱 ID 발급 | 라쿠텐 이치바 상품 검색 |

```bash
vercel env add NAVER_CLIENT_ID
vercel env add NAVER_CLIENT_SECRET
vercel env add RAKUTEN_APP_ID
```

설정 후 재배포하면 검색이 활성화된다.

## 환율 알림 · 이상 감지

"환율 알림" 탭:

- **목표 환율 알림** — 목표가(원/1엔)와 조건(이하/이상)을 설정하면 localStorage에 저장.
  탭이 열려 있는 동안 10분마다 + 탭 복귀 시 환율을 재조회하고, 도달하면 앱 상단 배너와
  브라우저 알림(권한 허용 시)을 1회 발송한다. 판정은 수동 입력값이 아닌 실시간 API 환율 기준.
- **이상 감지** — 독립 소스 3곳(er-api, frankfurter/ECB, fawazahmed0 currency-api)의 JPY→KRW를
  교차 검증해 중앙값 대비 편차를 표시. 최대 편차 1% 미만 정상 / 1~3% 주의 / 3% 이상 경고.
  은행 앱에 표시된 환율을 직접 입력하면 시장 기준과 비교해 토스뱅크 '반값 엔화' 오류 같은
  괴리(±3% 이상)를 경고한다. 로직: `src/lib/rateSources.js`, `src/hooks/useRateAlert.js`
- **수출입은행 고시환율 자동 비교(선택)** — `KOREAEXIM_API_KEY` 환경변수 설정 시
  `api/bank-rate.js`가 매매기준율을 받아 비교 목록에 자동 표시.
  키는 [koreaexim.go.kr 오픈API](https://www.koreaexim.go.kr/ir/HPHKIR019M01)에서 무료 발급.

무료 환율 소스는 대부분 하루 1회 갱신되므로 초 단위 시세 알림은 아니다. 백그라운드 웹푸시는 미지원(탭이 열려 있어야 동작).

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
