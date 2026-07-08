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
  App.jsx               환율 상태·알림 배너·탭 전환만 담당 (탭은 한 번 방문하면 숨김 유지로 상태 보존)
  ShopTab.jsx           직구 관부가세 계산
  TravelTab.jsx         여행자 휴대품 (품목별 간이세율)
  CompareTab.jsx        일본 vs 국내 가격 비교
  AlertTab.jsx          환율 알림 · 이상 감지 · 푸시 구독
  ui.jsx                테마·포매터·NumField/Row/Stamp/selectStyle 공용
  data/categories.js    관세율·면세한도·여행자 간이세율표(TRAVEL_RATES)
  lib/customs.js        직구 세금 계산(칸 공용), lib/rateSources.js 다중 소스 교차 검증
  lib/push.js           웹 푸시 클라이언트, lib/net.js fetch 타임아웃
  hooks/useExchangeRates.js  환율 로딩·캐시, hooks/useRateAlert.js 목표 알림
api/
  live-rate.js          실시간 환율, naver-shopping.js / rakuten.js 상품 검색 프록시
  bank-rate.js          수출입은행 고시환율, push.js 구독 CRUD
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

> ⚠️ Windows PowerShell에서 `"값" | vercel env add ...`로 등록하면 값 앞에 BOM(U+FEFF)이 붙어
> 인증이 전부 실패한다. Git Bash에서 `printf '%s' '값' | vercel env add NAME production`을 사용할 것.

## 환율 알림 · 이상 감지

- **목표 환율 알림** — 목표가(원/1엔)와 조건(이하/이상)을 localStorage에 저장. 탭이 열려 있는 동안
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

## PWA · 오프라인

- `public/manifest.webmanifest` + 아이콘(192/512/apple-touch) — 홈 화면 설치 가능
- `public/sw.js`가 오프라인 캐싱 담당: 페이지 이동은 network-first(새 배포 우선, 오프라인이면 캐시된
  앱 셸), `/assets/*` 해시 자산은 cache-first, `/api/*`는 네트워크 전용
- 서비스워커는 프로덕션 빌드에서만 등록(`src/main.jsx` — dev에선 HMR 간섭 방지). 푸시 수신과 같은 SW 파일 공유
- 환율은 localStorage 캐시(10분)가 있어 오프라인에서도 마지막 환율로 계산 가능

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

세율·한도 상수는 `src/data/categories.js`에서 수정.

## Vercel 배포

GitHub `main` 푸시 → 자동 배포 (Vite 프리셋: Build `vite build`, Output `dist`).
수동 배포는 `vercel deploy --prod`. 크론·환경변수 변경은 재배포해야 반영된다.
