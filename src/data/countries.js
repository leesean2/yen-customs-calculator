/**
 * 직구 출발국 레지스트리 — 통화·소액면세 한도·환율 표기 단위의 단일 출처.
 *
 * 지금 UI는 일본(직구) 전용이지만, 미국/유럽 등으로 확장할 때 이 데이터만 늘리면
 * 세금 계산(lib/customs.js: deMinimisUsd 파라미터)과 환율 맵(useExchangeRates:
 * krwPer[currency])이 그대로 재사용되도록 국가별 상수를 코드에서 분리해 둔다.
 *
 * - deMinimisUsd: 한국 반입 소액면세 한도(미화). 미국발은 한미 FTA로 200, 그 외 150.
 * - currency:     출발국 상품 통화(환율 맵 조회 키). 면세 판정용 USD 환율은 항상 별도로 쓴다.
 * - rateUnit:     환율 표기 단위 — 엔은 국내 관행상 100엔 기준, 그 외는 1 단위.
 */
export const ORIGIN_COUNTRIES = [
  { id: "JP", label: "일본", flag: "🇯🇵", currency: "JPY", symbol: "¥", locale: "ja-JP", deMinimisUsd: 150, rateUnit: 100 },
  { id: "US", label: "미국", flag: "🇺🇸", currency: "USD", symbol: "$", locale: "en-US", deMinimisUsd: 200, rateUnit: 1 },
  { id: "EU", label: "유럽(유로존)", flag: "🇪🇺", currency: "EUR", symbol: "€", locale: "de-DE", deMinimisUsd: 150, rateUnit: 1 },
  { id: "CN", label: "중국", flag: "🇨🇳", currency: "CNY", symbol: "¥", locale: "zh-CN", deMinimisUsd: 150, rateUnit: 1 },
];

export const getCountry = (id) =>
  ORIGIN_COUNTRIES.find((c) => c.id === id) ?? ORIGIN_COUNTRIES[0];

/** 현재 앱의 기본 출발국(일본) — 하드코딩된 엔화 경로가 참조한다 */
export const DEFAULT_COUNTRY = ORIGIN_COUNTRIES[0];

/** 면세 판정 통화 — 한도는 항상 미화 기준이라 상품 통화와 무관하게 필요 */
export const LIMIT_CURRENCY = "USD";
