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
  ShopTab.jsx           직구 관부가세 계산 (장바구니 — 여러 상품 합산 면세 판정) + 결과 링크 공유
  TravelTab.jsx         여행자 휴대품 (품목별 간이세율 + 술·담배·향수 별도 면세한도, 여행국 선택)
  RouteCompareTab.jsx   직구 vs 여행 반입 비교 (출발국 선택 · 면세 $150/$200 vs $800)
  CompareTab.jsx        해외(출발국) vs 국내 가격 비교
  AlertTab.jsx          환율 알림 · 이상 감지 · 푸시 구독
  TrendPanel.jsx        환율 추이 차트 전역 접이식 래퍼 (환율 설정 아래, 모든 탭 공통)
  OrderHistoryCard.jsx  구매 이력 카드 + 이번 달 지출 요약
  SavedCalcsCard.jsx    계산 저장함 — 계산 스냅샷을 이름 붙여 보관·복원
  SavedCompareBlock.jsx 저장함 비교 보기 — 선택 2~3건 나란히 + 합산과세 시나리오
  JsonBackupRow.jsx     JSON 내보내기/가져오기 줄 (구매 이력·저장함 공용)
  CategoryOptions.jsx   품목 <option> 목록 (직구·직구여행·국내비교 공용)
  HsRate.jsx            HS부호 정확 관세율 조회·적용 (상품 행별 선택 기능)
  ShipEstimate.jsx      배대지 배송비 추정 (무게·부피무게 → 대표 요율)
  ClearanceGuide.jsx    통관 절차 안내 — 판정별 목록통관/일반 수입신고 단계 + 신고 정보 복사
  PaymentCompare.jsx    결제 수단별 최종 비용 비교 — 해외 결제 수수료, 내 요율 저장
  CalcBreakdown.jsx     '계산 근거 펼쳐보기' 토글 (직구·여행자 공용)
  ui.jsx                테마(T→CSS 변수)·포매터·NumField/Row/Stamp/panel 공용
  index.css             라이트/다크 팔레트(prefers-color-scheme)를 CSS 변수로 정의
  data/categories.js    관세율·면세한도·간이세율표 + RATES_LAST_VERIFIED(세율 기준일)
  data/countries.js     직구 출발국 레지스트리(통화·소액면세 한도·표기 단위) — 다국가 확장 대비
  data/shipping.js      배대지 대표 요율(출발국별) + SHIPPING_RATES_VERIFIED(요율 기준일)
  lib/customs.js        직구·여행 세금 계산(탭 공용), lib/rateSources.js 다중 소스 교차 검증
  lib/shipping.js       배대지 배송비 추정(부피무게·0.5kg 올림), lib/clearance.js 통관 절차 분기
  lib/declaration.js    수입신고 참고 정보 초안, lib/payment.js 결제 수수료 계산·내 요율 저장
  lib/orders.js         구매 이력 저장소, lib/savedCalcs.js 계산 저장함, lib/share.js 계산 결과 URL 공유
  lib/snapshot.js       공유 쿼리 재계산(저장함 비교 보기), lib/percentile.js 환율 백분위
  lib/push.js           웹 푸시 클라이언트, lib/net.js fetch 타임아웃, lib/monitor.js 클라이언트 진단
  hooks/useExchangeRates.js  환율 로딩·캐시(통화→원 맵), useRateAlert.js 목표 알림, useOrders.js 합산과세 판정
tests/unit/             vitest 단위 테스트 — 세금 계산·이력 백업 순수 함수 (npm run test:unit)
tests/e2e/              Playwright E2E — 세금 경계값·계산 근거·공유·신선도 (npm run test:e2e)
tests/pwa/              오프라인 렌더 + 클라이언트 진단 비콘 (npm run test:pwa)
api/
  live-rate.js          실시간 환율, naver-shopping.js / rakuten.js 상품 검색 프록시
  customs-rate.js       관세청 과세환율(UNI-PASS), tariff-rate.js HS부호 관세율기본조회
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

각 소스는 통화→원 맵(`krwPer[currency]`)을 반환한다 — 실시간 소스(`api/_lib/rates.js`)와
일간 소스 모두 JPY·USD에 더해 EUR·CNY를 포함하며, 직구·비교 탭(`useOriginCountry`)과
다통화 목표 알림이 이 맵을 읽는다. 폴백이 몇 단계까지 떨어졌는지는 진단 로그로 남는다(아래).

## 다국가(출발국) 직구

직구·여행자·직구여행 비교·국내비교 탭은 출발국(여행국)을 선택할 수 있다(일본·미국·유럽·중국).
여행자 탭은 면세한도($800)가 나라와 무관해 통화·환율만 여행국을 따른다. 국가별 상수는
코드가 아니라 `data/countries.js` 레지스트리에 있어, 나라를 늘릴 때 데이터만 추가하면 된다:

- **소액면세 한도** — `deMinimisUsd`(미화). 미국발은 한미 FTA로 **$200**, 그 외 **$150**.
  `calcImportCost({ ..., deMinimisUsd })`가 이 값을 받아 면세 판정한다.
  `categories.js`의 `DUTY_FREE_LIMIT_USD`도 이 레지스트리에서 파생된다.
- **통화·환율** — 해석은 `hooks/useOriginCountry.js` 한 곳에서: 공유 스냅샷 → JPY·USD는
  상단 환율 설정(수동 입력 반영) → EUR·CNY는 실시간 맵(`krwPer`, 장중 소스 포함) →
  frankfurter(ECB 일간, `hooks/useOriginRate.js` + `lib/fx.js`) 순. 조회 실패 시 마지막
  성공값(localStorage)으로 폴백하고 고시일과 재시도 버튼을 보여준다(`OriginSelect.jsx`).
  면세 판정용 USD 환율은 상품 통화와 무관하게 항상 필요해 `LIMIT_CURRENCY`로 분리.
- **목표 환율 알림** — 알림 탭에서 통화(JPY·USD·EUR·CNY)를 골라 목표를 걸 수 있다.
  백그라운드 푸시 구독에도 통화가 저장되어, 크론이 구독별 통화의 환율로 판정해 발송한다
  (통화 없는 기존 구독은 엔 취급).
- **환율 추이 차트** — 환율 설정 바로 아래의 전역 접이식 패널(`TrendPanel.jsx`,
  열림 상태 localStorage 유지)이라 어느 탭에서든 볼 수 있다. 알림 탭에서 선택한
  통화의 30/90일 시계열(ECB 일간, `fetchKrwSeries`)을 라인 차트로 보여준다
  (`src/RateTrend.jsx`) — 최저·최고 직접 라벨과 호버 크로스헤어 툴팁,
  목표가를 정할 때 현재가 싼 편인지 참고용.
  ECB 일간은 영업일 하루 지연이라 **실시간 시세 기준선**(krwPer, 빨간 점선)을
  함께 그리고 요약 줄에도 "현재(일간) · 실시간"으로 병기한다.
  차트 아래에 **최근 1년 백분위 배지**(`lib/percentile.js`, 동률 중간 순위) —
  "지금 환율은 최근 1년 중 하위 n% — 싼 편입니다"를 색조(싼/중간/비싼)와 함께
  판정하며, 기준값은 실시간 시세(없으면 일간 마지막 값)를 쓴다.
- **표기** — `symbol`/`locale`(금액), `rateUnit`/`rateUnitLabel`(환율 — 엔은 국내 관행상
  100엔 기준 "원/100엔", 그 외 1단위), `short`(문장 속 국가명 "일본 내 배송비").

구매 이력은 주문에 출발국을 기록하고, 합산과세 판정·월간 물품 합계는 같은 출발국(통화)
기록끼리만 합산한다 — 통화가 섞이면 단일 환율로 환산할 수 없기 때문.

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

## 가격 비교 (해외 vs 국내)

라쿠텐·네이버쇼핑 검색 결과 또는 직접 입력한 가격으로, 직구 최종가(상품가 환산 + 국제 배송비 +
관부가세)와 국내 구매가를 비교해 어느 쪽이 이득인지 판정(차이 3% 미만은 "비슷함").
출발국을 고르면 통화·면세한도·현지 쇼핑몰 링크가 함께 바뀐다(`FOREIGN_SHOPS`).
판정에는 해외 상품가 입력과 환율 로딩이 모두 필요하다.

- API 키가 없어도 동작: 검색어로 **라쿠텐·아마존재팬·요도바시 / 네이버쇼핑·다나와** 검색 페이지를
  바로 여는 외부 링크 제공 → 가격 확인 후 수동 입력
- 검색 API는 일본(라쿠텐)만 있고, 미국(아마존·이베이·월마트)·유럽(아마존 독일·프랑스)·
  중국(타오바오·징둥·알리)은 외부 검색 링크 + 수동 입력으로 동작한다

검색 API는 `api/`의 서버리스 함수가 중계(키는 서버에만 존재, 검색어 80자 제한, 8초 타임아웃):

| 환경변수 | 발급처 | 용도 | 상태 |
| --- | --- | --- | --- |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | [developers.naver.com](https://developers.naver.com/apps/) → "검색" API | 네이버쇼핑 검색 | 설정됨 |
| `RAKUTEN_APP_ID` | [webservice.rakuten.co.jp](https://webservice.rakuten.co.jp/) | 라쿠텐 검색 | 미설정 (외부 링크로 대체) |
| `KOREAEXIM_API_KEY` | [koreaexim.go.kr 오픈API](https://www.koreaexim.go.kr/ir/HPHKIR019M01) | 수출입은행 고시환율 비교 | 설정됨 |
| `UNIPASS_API_KEY` | [unipass.customs.go.kr 오픈API](https://unipass.customs.go.kr/csp/openapiInfo.do) → "관세환율정보" | 과세환율(실제 세액 기준) 병기 + 면세 판정 괴리 경고 | 미설정 (표시 생략) |
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
  수출입은행 고시(`/api/bank-rate?cur=`, 키 설정 시 — 위안화는 고시 코드 CNH)를 중앙값과 교차 검증.
  **알림 통화를 따라 JPY·USD·EUR·CNY 모두 지원**(통화 전환 시 재조회, 내 환율 입력도 초기화).
  최대 편차 1% 미만 정상 / 1~3% 주의 / 3% 이상 경고. 은행 앱에 표시된 환율을 직접 입력하면
  시장 기준과 비교해 토스뱅크 '반값 엔화' 같은 괴리를 경고 — 엔은 **1엔·100엔 기준 모두
  자동 인식**(100 이상이면 ÷100).

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
이력 카드의 **내보내기/가져오기** 버튼으로 JSON 파일 백업·복원이 가능하다 — localStorage
전용이라 브라우저를 바꾸면 사라지기 때문. 가져오기는 필드 화이트리스트로 검증하고
id 중복은 기존 기록을 유지한다(`exportOrders`/`parseImportedOrders`/`mergeOrders`).

기록에는 기록 시점의 예상 세금(`taxKrw`)·최종 비용(`finalKrw`)도 저장되어, 이력 카드 상단에
**이번 달 주문 건수·물품가 합계·예상 세금 합계**가 요약으로 표시된다.

## 계산 결과 공유 · 계산 근거

- **결과 링크 복사** — 직구 탭 결과 카드의 버튼으로 입력값+환율 스냅샷을 URL 쿼리에 담아 복사
  (`src/lib/share.js`, 파라미터 p/l/i/c/o/j/u — JPY·USD 외 출발국은 r에 원/1단위 환율,
  장바구니 상품이 2개 이상이거나 HS 세율 적용 상품이 있으면 it에
  "가격:품목[:hs부호:세율%]" 목록도 담는다).
  링크로 열면 같은 계산이 재현되며, 공유된 환율은
  수동 입력 취급이라 실시간 값이 덮어쓰지 않는다. 판매자·상품명은 개인 기록이라 담지 않는다.
- **계산 근거 펼쳐보기** — 직구·여행자 결과 카드에서 환산→면세 판정→세목별 수식을 입력값이
  대입된 형태로 펼쳐볼 수 있다 (`src/CalcBreakdown.jsx`).

## 직구 편의 기능 (직구 탭)

- **HS부호 정확 관세율** — 상품 행의 접이식 필드에서 HS부호(10자리)를 조회하면
  `/api/tariff-rate`(UNI-PASS 관세율기본조회, `UNIPASS_TARIFF_API_KEY` 필요)가
  기본세율(A)과 WTO협정세율(C) 중 낮은 쪽을 적용세율로 준다. FTA 협정세율은 원산지 증명이
  필요해 자동 적용하지 않고 참고 최저값만 보여준다. 적용하면 품목 대푯값 대신 계산에 쓰이고
  공유 링크에도 스냅샷으로 담긴다.
- **배대지 배송비 추정** — 국제 배송비를 모를 때 실무게(+선택: 상자 치수)를 넣으면
  부피무게(가로×세로×높이÷6000)와 비교해 큰 쪽을 0.5kg 단위로 올림한 청구 무게에
  출발국별 대표 요율(`data/shipping.js`, 첫 0.5kg + 0.5kg당 추가)을 적용해 추정치를
  입력란에 채워 준다. 업체별로 다르다는 전제라 요율 기준일과 함께 '추정치'로 표기.
  자기 배대지 요금표를 아는 사용자는 **내 요율**(첫 0.5kg·추가 0.5kg당)을 국가별로
  저장해 대표 요율을 덮어쓸 수 있다(localStorage, `loadCustomShipRates`).
- **계산 저장함** — 현재 계산을 이름 붙여 localStorage에 보관(`lib/savedCalcs.js`, 최대 20건,
  만료 없음). 저장 본체는 공유 링크와 같은 쿼리 스냅샷이라, '열기'는 그 쿼리로 이동해
  공유 링크 복원 경로를 그대로 재사용한다 — 저장 시점의 입력값·환율이 그대로 재현된다.
  구매 이력과 같은 JSON 내보내기/가져오기(공용 `JsonBackupRow.jsx`)로 백업·복원할 수 있다.
  2건 이상이면 체크로 2~3건을 골라 **비교 보기**(`SavedCompareBlock.jsx`) — 저장 스냅샷을
  페이지 이동 없이 재계산(`lib/snapshot.js`)해 나란히 보여주고, 같은 출발국이면 '한 주문으로
  합산과세될 때'와 대조해 따로/합산의 세금 차이를 판정 문구로 앞세운다.
- **통관 절차 안내** — 결과 카드의 접이식 안내(`lib/clearance.js`)가 판정에 따라
  목록통관(면세: 수입신고 생략) 또는 일반 수입신고(과세·배제 품목: 신고→세액 납부→반출)
  단계를 보여준다. 예상 세액이 납부 단계에 연동되고, 개인통관고유부호 발급·화물진행정보
  조회 링크를 함께 준다. 과세면 **수입신고 참고 정보 복사**(`lib/declaration.js`) —
  품목(HS부호 포함)·적용 환율·과세가격·세목별 세액 요약을 특송업체·관세사에 전달할
  텍스트로 클립보드에 담는다.
- **결제 수단별 최종 비용 비교** — 결과 카드의 접이식 표(`PaymentCompare.jsx`).
  해외 결제 수수료(일반 신용카드 1.4%·해외겸용 체크 0.7%·트래블카드 0% 대표치)를
  **외화 결제 금액**(물품가+현지 배송의 원화 환산)에만 얹어 수단별 총액을 비교한다 —
  국제 배송비(원화 청구)·세금(원화 납부)은 수수료 대상이 아니다. 요율은 셀에서 고쳐
  내 카드 조건으로 저장(localStorage, `lib/payment.js`), 최저 수단에 '최저' 표시.

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
- **장바구니**(직구 탭): 상품 여러 줄 합산 — 면세 판정은 주문 전체 물품가격 기준이라 각각
  한도 이하라도 합치면 과세된다. 과세 시 운임을 상품가 비율로 안분해 품목별 관세율·개소세·
  부가세 면제를 각각 적용(`calcCartImportCost` — `calcImportCost`는 이것의 1개짜리 위임)
- 가방·시계: (과세가격+관세) 200만원 초과분 개별소비세 20% + 교육세(개소세의 30%)
- 건강기능식품: 목록통관 배제 → 금액 무관 과세 가능 경고
- **여행자**: USD 800 면세 공제 후 품목별 간이세율(관세법 시행령 별표2) 적용, 자진신고 시 30% 감면(한도 20만원)
  - 단일간이세율 20% (과세대상 합계 USD 1,000 이하 — 초과 시 선택 불가 경고)
  - 그 밖의 물품 15% / 의류·신발·가죽·섬유 18% / 모피 19%
  - 고급시계·가방, 보석·귀금속: 15% + 기준액(각 192.3만원 / 480.8만원) 초과분 45%
- **별도 면세 품목**(여행자 탭, 기본 $800과 별개): 술 2병·2L·$400(모두 충족해야 면세, 초과 시
  전체 과세) / 담배 궐련 200개비 / 향수 100mL. 주류는 주종별 세액을 실계산한다
  (`calcAlcoholTax`: 관세 → 주세(증류주 72%·발효주 30% 종가, 맥주 리터당 종량) → 교육세 →
  부가세 10%, 자진신고 감면은 세목 분리라 관세분 30%만). 담배·향수 초과는 신고 안내만.
- **과세환율 병기**(직구 탭): 실제 세액은 관세청 주간 고시 '과세환율' 기준이라, `UNIPASS_API_KEY`가
  설정되면 `/api/customs-rate`로 받아 물품가격의 과세환율 환산액을 병기하고, 시장 환율과
  면세 판정이 갈리는 경계 금액이면 경고를 띄운다 (`hooks/useCustomsRate.js`).

세율·한도 상수는 `src/data/categories.js`에서 수정. 관세청 고시와 대조해 확인했으면
`RATES_LAST_VERIFIED`를 그 날짜로 갱신할 것 — 기준일에서 90일(`RATES_STALE_AFTER_DAYS`)이
지나면 앱 상단에 "세율 확인 필요" 배너가 자동으로 뜬다.

## 테스트

```bash
npm run test:unit  # vitest — 세금 계산·이력 백업 순수 함수 단위 테스트 (1초 미만)
npm run test:e2e   # Playwright — vite dev 서버 자동 기동, 외부 환율 API 차단(고정 환율 수동 입력)
npm run test:pwa   # 프로덕션 빌드+vite preview 상대로 서비스워커 오프라인 동작 검증
```

세 스위트 모두 GitHub Actions(`.github/workflows/ci.yml`)가 push/PR마다 자동 실행한다
(Vercel 배포와는 독립 — CI 실패가 배포를 막지는 않으니 빨간 커밋은 직접 되돌릴 것).
`test:unit`은 `lib/customs.js`(면세·간이세율·주류 세목·장바구니 안분)와
`lib/orders.js`(백업 왕복·병합)의 경계값을 브라우저 없이 검증한다 — 계산 로직을 고치면
여기부터 돌리는 게 빠르다.
`test:e2e`는 같은 경계값을 UI 입력→화면 결과로, 더불어 계산 근거 수식, URL 공유 왕복,
다국가·별도 면세·환율 추이·세율 신선도 배너(가짜 시계)까지 검증한다. 세율·문구·수식을 바꾸면
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
