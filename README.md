# 엔화 직구 · 여행 세금 계산기

일본 직구 관부가세와 여행자 휴대품 세금을 실시간 환율로 계산하고, 일본 vs 국내 가격 비교와
환율 목표 알림·이상 감지(웹 푸시 포함)까지 제공하는 React(Vite) 앱.

- 배포: https://yen-calc.vercel.app (GitHub `main` 푸시 시 Vercel 자동 배포)

## 실행

```bash
npm install
npm run dev      # http://localhost:5173 — 서버리스 API(api/) 없이 화면만
vercel dev       # 검색·환율·푸시 API 포함 로컬 실행
npm run build    # dist/ 생성
```

## 프로젝트 구조

```
src/
  App.jsx               환율 상태·알림/신선도 배너·탭 전환·공유 링크 복원 (탭은 한 번 방문하면 숨김 유지로 상태 보존)
  ShopTab.jsx           직구 관부가세 계산 + 결과 링크 공유
  TravelTab.jsx         여행자 휴대품 (품목별 간이세율)
  RouteCompareTab.jsx   직구 vs 여행 반입 비교 (면세 $150 vs $800)
  CompareTab.jsx        일본 vs 국내 가격 비교
  AlertTab.jsx          환율 알림 · 이상 감지 · 푸시 구독
  OrderHistoryCard.jsx  구매 이력 카드 + 이번 달 지출 요약
  CalcBreakdown.jsx     '계산 근거 펼쳐보기' 토글 (직구·여행자 공용)
  ui.jsx                테마(T→CSS 변수)·포매터·NumField/Row/Stamp/panel 공용
  index.css             라이트/다크 팔레트(prefers-color-scheme)를 CSS 변수로 정의
  data/categories.js    관세율·면세한도·간이세율표 + RATES_LAST_VERIFIED(세율 기준일)
  data/countries.js     직구 출발국 레지스트리(통화·소액면세 한도·표기 단위) — 다국가 확장 대비
  lib/customs.js        직구·여행 세금 계산(탭 공용), lib/rateSources.js 다중 소스 교차 검증
  lib/orders.js         구매 이력 저장소, lib/share.js 계산 결과 URL 공유
  lib/push.js           웹 푸시 클라이언트, lib/net.js fetch 타임아웃, lib/monitor.js 클라이언트 진단
  hooks/useExchangeRates.js  환율 로딩·캐시(통화→원 맵), useRateAlert.js 목표 알림, useOrders.js 합산과세 판정
tests/e2e/              Playwright E2E — 세금 경계값·계산 근거·공유·신선도 (npm run test:e2e)
tests/pwa/              오프라인 렌더 + 클라이언트 진단 비콘 (npm run test:pwa)
api/
  live-rate.js          실시간 환율, naver-shopping.js / rakuten.js 상품 검색 프록시
  bank-rate.js          수출입은행 고시환율, push.js 구독 CRUD, log.js 클라이언트 진단 수집
  cron/check-rates.js   일일 환율 검사 + 푸시 발송 (vercel.json crons)
  _lib/                 서버 공용 (rates.js 환율 소스, subs.js 구독 저장소)
public/sw.js            푸시 수신 서비스워커
```

## 환율 소스

`useExchangeRates`가 `/api/live-rate`를 1순위로 사용:
**manana.kr(야후 기반, 수 분 단위 갱신) → Yahoo Finance 차트 → open.er-api.com → frankfurter(일 1회)**
순으로 폴백. localStorage 10분 캐시 → 재방문 시 즉시 표시 후 백그라운드 갱신.
모든 소스 실패 시 캐시 사용, 캐시도 없으면 수동 입력 안내. 사용자가 환율을 직접 수정하면
override 모드로 전환되고 "실시간 환율로 되돌리기" 버튼이 뜬다.
실시간 소스는 비공식이라 형식이 바뀌면 자동으로 일간 소스로 넘어간다.
(네이버 금융 계산기 엔드포인트는 2026-07 현재 500을 반환해 제외)

각 소스는 통화→원 맵(`krwPer[currency]`)을 반환한다 — 일간 소스(er-api/frankfurter)는
USD 기준으로 KRW·JPY·EUR·CNY를 함께 받아 두어, 출발국이 늘어도 조회 키만 바꾸면 된다
(지금 UI는 JPY·USD만 읽는다). 폴백이 몇 단계까지 떨어졌는지는 진단 로그로 남는다(아래).

## 다국가(출발국) 직구

직구 탭은 출발국을 선택할 수 있다(일본·미국·유럽·중국). 국가별 상수는 코드가 아니라
`data/countries.js` 레지스트리에 있어, 나라를 늘릴 때 데이터만 추가하면 된다:

- **소액면세 한도** — `deMinimisUsd`(미화). 미국발은 한미 FTA로 **$200**, 그 외 **$150**.
  `calcImportCost({ ..., deMinimisUsd })`가 이 값을 받아 면세 판정한다.
  `categories.js`의 `DUTY_FREE_LIMIT_USD`도 이 레지스트리에서 파생된다.
- **통화·환율** — JPY·USD는 상단 환율 설정(실시간·수동 입력)을 그대로 쓰고,
  EUR·CNY는 `hooks/useOriginRate.js`가 frankfurter(ECB 일간, `lib/fx.js`)에서 별도 조회한다.
  조회 실패 시 마지막 성공값(localStorage)으로 폴백하고 고시일과 재시도 버튼을 보여준다.
  면세 판정용 USD 환율은 상품 통화와 무관하게 항상 필요해 `LIMIT_CURRENCY`로 분리.
- **표기** — `symbol`/`locale`(금액), `rateUnit`/`rateUnitLabel`(환율 — 엔은 국내 관행상
  100엔 기준 "원/100엔", 그 외 1단위), `short`(문장 속 국가명 "일본 내 배송비").

구매 이력은 주문에 출발국을 기록하고, 합산과세 판정·월간 물품 합계는 같은 출발국(통화)
기록끼리만 합산한다 — 통화가 섞이면 단일 환율로 환산할 수 없기 때문.
(실시간 `/api/live-rate`는 아직 JPY·USD만 제공 — 다른 통화가 필요하면 `api/_lib/rates.js`를 넓힐 것)

## 클라이언트 진단 (에러 모니터링)

Sentry 같은 외부 계정 없이, **개인정보 없는 기술 진단만** Vercel 함수 로그로 보낸다
(`src/lib/monitor.js` → `/api/log` → `console.error("[client-diag]", …)`, 대시보드에서 grep).

- **수집 대상**: 처리되지 않은 JS 오류(메시지·스택·`pathname`)와 **환율 폴백 진단** —
  1순위 실패 후 몇 단계까지 떨어졌는지(`rate_fallback` depth+실패 소스명), 전부 실패(`rate_all_failed`).
- **보내지 않는 것**: 상품가격·구매 이력·환율 입력값 등 개인/거래 데이터. 오류 `path`는
  쿼리스트링을 뺀 `pathname`만(공유 링크의 가격 입력 유출 방지). 구매 이력의 "서버 전송 없음"
  원칙과 충돌하지 않도록 범위를 기술 진단에 한정한다.
- **동작 조건**: 프로덕션에서만 초기화(`import.meta.env.PROD`, dev/테스트는 no-op),
  `navigator.sendBeacon`으로 비동기 전송, 세션당 25건 상한 + 동일 메시지 중복 억제, 전송 실패는 무해.
- 서버(`api/log.js`)는 화이트리스트 필드만·4KB 이하만 로깅해 예상 밖 대형/민감 데이터를 막는다.
- **Sentry 전달(선택)**: 환경변수 `SENTRY_DSN`이 설정되면 서버가 진단을 Sentry로도 보낸다
  (의존성·클라이언트 SDK 없이 HTTP envelope 직접 호출, DSN은 서버에만). JS 오류는 `error`,
  전 소스 실패는 `warning`, 폴백은 `info` 레벨로 태그(`kind`/`diag_event`)와 함께 전송 —
  Sentry에서 레벨/태그로 필터링·뮤트할 수 있다. 미설정이면 콘솔 로깅만 하고 넘어간다.

## 가격 비교 (일본 vs 국내)

라쿠텐·네이버쇼핑 검색 결과 또는 직접 입력한 가격으로, 직구 최종가(상품가 환산 + 국제 배송비 +
관부가세)와 국내 구매가를 비교해 어느 쪽이 이득인지 판정(차이 3% 미만은 "비슷함").
판정에는 일본 상품가 입력과 환율 로딩이 모두 필요하다.

- API 키가 없어도 동작: 검색어로 **라쿠텐·아마존재팬·요도바시 / 네이버쇼핑·다나와** 검색 페이지를
  바로 여는 외부 링크 제공 → 가격 확인 후 수동 입력
- 아마존재팬은 공개 API가 없어 항상 수동 입력

검색 API는 `api/`의 서버리스 함수가 중계(키는 서버에만 존재, 검색어 80자 제한, 8초 타임아웃):

| 환경변수 | 발급처 | 용도 | 상태 |
| --- | --- | --- | --- |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | [developers.naver.com](https://developers.naver.com/apps/) → "검색" API | 네이버쇼핑 검색 | 설정됨 |
| `RAKUTEN_APP_ID` | [webservice.rakuten.co.jp](https://webservice.rakuten.co.jp/) | 라쿠텐 검색 | 미설정 (외부 링크로 대체) |
| `KOREAEXIM_API_KEY` | [koreaexim.go.kr 오픈API](https://www.koreaexim.go.kr/ir/HPHKIR019M01) | 수출입은행 고시환율 비교 | 설정됨 |
| `SENTRY_DSN` | Sentry 프로젝트 → Client Keys (DSN) | 클라이언트 진단 Sentry 전달(선택) | 미설정 (콘솔 로깅만) |

> ⚠️ Windows PowerShell에서 `"값" | vercel env add ...`로 등록하면 값 앞에 BOM(U+FEFF)이 붙어
> 인증이 전부 실패한다. Git Bash에서 `printf '%s' '값' | vercel env add NAME production`을 사용할 것.

## 직구 vs 여행 반입 비교

같은 상품을 **직구로 배송받을 때**와 **여행 중 사서 직접 들고 올 때**의 세금·비용을 비교한다.
핵심은 면세한도 차이(**직구 $150 초과 시 전체 과세** vs **여행 $800 초과분만 과세**)라, 같은 가격이라도
경로에 따라 유·불리가 크게 갈린다. `calcImportCost`(직구)와 `calcTravelTax`(여행, `lib/customs.js`에서
여행자 탭과 공유)로 양쪽 최종가를 계산해 판정(차이 3% 미만은 "비슷함").
여행은 이미 현지에 있다고 보고 항공권을 제외하며, 주류·담배는 간이세율 미적용이라 판정을 보류한다.

## 다크 모드

`prefers-color-scheme`를 따르는 자동 라이트/다크 지원. 모든 색은 `ui.jsx`의 `T`가 `var(--c-*)` CSS 변수를
가리키고, 실제 팔레트는 `index.css`에서 라이트/다크로 정의한다 — 인라인 style이 전부 `T`를 거치므로
변수만 바꾸면 앱 전체가 테마를 따라간다. 다크 인디고는 흰 글자 버튼과 어두운 배경 위 라벨 양쪽에서
읽히는 중간 밝기를 쓴다. `<meta name="theme-color">`도 라이트/다크 두 벌을 둔다.

## 환율 알림 · 이상 감지

- **환율 표기** — 사용자에게 보이는 엔화 환율은 모두 국내 관행대로 **100엔 기준**(내부 계산은 1엔당 원화).
- **목표 환율 알림** — 목표가(원/100엔)와 조건(이하/이상)을 localStorage에 저장. 탭이 열려 있는 동안
  10분마다 + 탭 복귀 시 재조회, 도달하면 상단 배너(모든 탭에서 표시) + 브라우저 알림 1회.
  판정은 수동 입력값이 아닌 실시간 API 환율 기준.
- **이상 감지** — 클라이언트 소스 3곳(er-api, frankfurter, currency-api) + 실시간 시세(`/api/live-rate`) +
  수출입은행 고시(`/api/bank-rate`, 키 설정 시)를 중앙값과 교차 검증. 최대 편차 1% 미만 정상 /
  1~3% 주의 / 3% 이상 경고. 은행 앱에 표시된 환율을 직접 입력하면 시장 기준과 비교해
  토스뱅크 '반값 엔화' 같은 괴리를 경고 — **1엔·100엔 기준 모두 자동 인식**(100 이상이면 ÷100).

## 웹 푸시 (백그라운드 알림)

탭을 닫아도 알림 수신. 환율 알림 탭에서 구독/해제.

- **클라이언트**: `public/sw.js` + `src/lib/push.js` — 구독 시에만 서비스워커 설치
- **저장소**: Vercel Blob(private)에 **구독 1건당 파일 1개** `subs/<endpoint해시>.json`.
  단일 파일 read-modify-write는 Blob CDN 캐시 지연·동시 쓰기 유실 때문에 금지 (실측으로 확인된 버그였음)
- **발송**: `api/cron/check-rates.js`를 Vercel Cron이 매일 01:00 UTC(10:00 KST)에 호출 —
  목표 도달·소스 편차 3% 이상 시 web-push 발송, 종류별 20시간 쿨다운,
  영구 4xx(400/403/404/410) 응답 구독 자동 삭제. `CRON_SECRET` Bearer 인증으로 외부 호출 차단.
- **한계**: Hobby 플랜은 크론 하루 1회 제한. iOS Safari는 홈 화면 추가 시에만 푸시 지원.
- 필요 환경변수: `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`
  (`npx web-push generate-vapid-keys`), `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`
  (`vercel blob create-store <name> --access private --yes`로 생성 시 자동 등록) — 모두 설정됨

## 구매 이력 · 합산과세 추적

직구 탭에서 판매자(+상품명 메모)를 입력하고 "이 주문 기록"을 누르면 localStorage에 저장
(`src/lib/orders.js`, 최대 50건·60일 보존, 서버 전송 없음). 이후 **같은 날 같은 판매자**로
주문을 입력하면 기록과의 합산 물품가격을 달러로 환산해 면세한도(USD 150) 초과 여부를 자동 경고한다.
합산 판정 기준은 면세 판정과 동일한 '물품가격'(상품가+일본 내 배송비).

기록에는 기록 시점의 예상 세금(`taxKrw`)·최종 비용(`finalKrw`)도 저장되어, 이력 카드 상단에
**이번 달 주문 건수·물품가 합계·예상 세금 합계**가 요약으로 표시된다.

## 계산 결과 공유 · 계산 근거

- **결과 링크 복사** — 직구 탭 결과 카드의 버튼으로 입력값+환율 스냅샷을 URL 쿼리에 담아 복사
  (`src/lib/share.js`, 파라미터 p/l/i/c/o/j/u — JPY·USD 외 출발국은 r에 원/1단위 환율도 담는다).
  링크로 열면 같은 계산이 재현되며, 공유된 환율은
  수동 입력 취급이라 실시간 값이 덮어쓰지 않는다. 판매자·상품명은 개인 기록이라 담지 않는다.
- **계산 근거 펼쳐보기** — 직구·여행자 결과 카드에서 환산→면세 판정→세목별 수식을 입력값이
  대입된 형태로 펼쳐볼 수 있다 (`src/CalcBreakdown.jsx`).

## PWA · 오프라인

- `public/manifest.webmanifest` + 아이콘(192/512/apple-touch) — 홈 화면 설치 가능
- iOS는 `apple-mobile-web-app-*` 메타(`index.html`)로 홈 화면 추가 시 standalone 실행
  (웹 푸시는 iOS에서 홈 화면 추가+standalone이 전제)
- `public/sw.js`가 오프라인 캐싱 담당: 페이지 이동은 network-first(새 배포 우선, 오프라인이면 캐시된
  앱 셸), `/assets/*` 해시 자산은 cache-first, `/api/*`는 네트워크 전용
  - **install 시 앱 셸+해시 자산을 프리캐시** — 없으면 '첫 방문 직후 오프라인'에 자산을 못 받아 빈 화면
  - `caches.match(..., { ignoreVary: true })` — crossorigin 모듈 자산은 Vary 헤더 때문에
    URL이 같아도 match가 미스날 수 있어 URL만으로 매칭 (실측 확인된 버그였음)
- 서비스워커는 프로덕션 빌드에서만 등록(`src/main.jsx` — dev에선 HMR 간섭 방지). 푸시 수신과 같은 SW 파일 공유
- 환율은 localStorage 캐시(10분)가 있어 오프라인에서도 마지막 환율로 계산 가능
- 오프라인 동작은 `npm run test:pwa`가 프로덕션 빌드(`vite preview`)를 상대로 SW 등록·활성화와
  '첫 방문 직후 오프라인 렌더'를 자동 검증한다. 단, iOS Safari 실기기 동작은 재현이 어려워
  별도 수동 확인이 필요하다(아래 참고)

## 계산 로직 (2026-07 기준, 참고용)

- **직구 소액면세**: 물품가격(상품가+현지 배송비) USD 150 이하 → 면세, 초과 시 **전체 금액** 과세
- 과세가격 = 물품가격 + 국제운임 / 관세 = 과세가격 × 품목별 관세율 / 부가세 = (과세가격+관세) × 10%
- 가방·시계: (과세가격+관세) 200만원 초과분 개별소비세 20% + 교육세(개소세의 30%)
- 건강기능식품: 목록통관 배제 → 금액 무관 과세 가능 경고
- **여행자**: USD 800 면세 공제 후 품목별 간이세율(관세법 시행령 별표2) 적용, 자진신고 시 30% 감면(한도 20만원)
  - 단일간이세율 20% (과세대상 합계 USD 1,000 이하 — 초과 시 선택 불가 경고)
  - 그 밖의 물품 15% / 의류·신발·가죽·섬유 18% / 모피 19%
  - 고급시계·가방, 보석·귀금속: 15% + 기준액(각 192.3만원 / 480.8만원) 초과분 45%
  - 주류·담배: 간이세율 미적용 — 관세청 계산기 안내

세율·한도 상수는 `src/data/categories.js`에서 수정. 관세청 고시와 대조해 확인했으면
`RATES_LAST_VERIFIED`를 그 날짜로 갱신할 것 — 기준일에서 90일(`RATES_STALE_AFTER_DAYS`)이
지나면 앱 상단에 "세율 확인 필요" 배너가 자동으로 뜬다.

## 테스트

```bash
npm run test:e2e   # Playwright — vite dev 서버 자동 기동, 외부 환율 API 차단(고정 환율 수동 입력)
npm run test:pwa   # 프로덕션 빌드+vite preview 상대로 서비스워커 오프라인 동작 검증
```

`test:e2e`는 세금 로직 경계값(면세 $150, 개소세 200만원, 합산과세 트리거), 계산 근거 수식,
URL 공유 왕복, 세율 신선도 배너(가짜 시계)를 22개 시나리오로 검증한다. 세율·문구·수식을 바꾸면
반드시 실행할 것. `test:pwa`는 SW 등록·활성화와 첫 방문 직후 오프라인 렌더를 검증한다.

### 실기기 수동 확인 (자동화 불가 영역)

SW 오프라인은 Chromium으로 자동 검증하지만, iOS Safari의 홈 화면 PWA·웹 푸시는 시뮬레이터/
실기기 동작이 달라 아래는 실기기에서 직접 확인해야 한다:

- **iOS Safari**: 공유 → 홈 화면에 추가 → 아이콘으로 실행(주소창 없는 standalone 확인) →
  기내 모드로 전환 후 재실행 시 화면이 정상 렌더되는지 → 환율 알림 탭에서 푸시 구독 후 알림 수신
  (iOS는 홈 화면 추가+standalone 상태에서만 푸시 동작)
- **Android Chrome**: 설치 배너/메뉴로 설치 → 기내 모드 재실행 오프라인 렌더 → 푸시 구독·수신

## Vercel 배포

GitHub `main` 푸시 → 자동 배포 (Vite 프리셋: Build `vite build`, Output `dist`).
수동 배포는 `vercel deploy --prod`. 크론·환경변수 변경은 재배포해야 반영된다.
