/**
 * 품목별 관세율 (참고용)
 * duty: 관세율, luxury: 개별소비세 대상(가방·시계),
 * excluded: 목록통관 배제 품목, vatExempt: 부가세 면제
 *
 * 세율·한도는 법령 개정으로 바뀔 수 있다. 최신 고시와 대조해 확인할 때마다
 * RATES_LAST_VERIFIED를 갱신할 것 — 기준일에서 RATES_STALE_AFTER_DAYS가
 * 지나면 앱이 "세율 확인 필요" 배너를 띄운다.
 */
import { DEFAULT_COUNTRY } from "./countries.js";

export const RATES_LAST_VERIFIED = "2026-07-08"; // 관세청 고시와 마지막으로 대조한 날
export const RATES_STALE_AFTER_DAYS = 90;
export const CATEGORIES = [
  { id: "electronics", label: "전자기기 (폰·노트북·태블릿·카메라)", duty: 0, note: "ITA 협정 품목은 관세 0%, 부가세 10%만 부과됩니다." },
  { id: "clothing", label: "의류 · 신발", duty: 0.13 },
  { id: "bag", label: "가방 · 시계", duty: 0.08, luxury: true, note: "과세가격 200만원 초과분에는 개별소비세 20% + 교육세가 추가됩니다." },
  { id: "cosmetics", label: "화장품 · 향수", duty: 0.08 },
  { id: "audio", label: "이어폰 · 음향기기", duty: 0.08 },
  { id: "hobby", label: "피규어 · 게임 · 취미용품", duty: 0.08 },
  { id: "health", label: "건강기능식품 · 영양제", duty: 0.08, excluded: true, note: "목록통관 배제 품목 — 150달러 이하여도 수입신고 대상이라 과세될 수 있습니다. 자가사용 인정 수량(총 6병)도 확인하세요." },
  { id: "book", label: "서적 · 음반", duty: 0, vatExempt: true, note: "서적류는 관세 0%, 부가가치세도 면제됩니다." },
  { id: "etc", label: "기타 일반물품", duty: 0.08 },
];

export const DUTY_FREE_LIMIT_USD = DEFAULT_COUNTRY.deMinimisUsd; // 일본발 직구 소액면세 한도(150) — 출발국별 값은 countries.js
export const TRAVELER_LIMIT_USD = 800;    // 여행자 휴대품 기본 면세한도
export const LUXURY_SCT_BASE = 2_000_000; // 개별소비세 기준(가방·시계)

/**
 * 여행자 별도 면세한도 — 기본 $800과 별개로 적용되는 품목 (관세법 시행규칙 §48)
 * 술은 세 조건(병수·용량·금액)을 모두 충족해야 면세, 하나라도 초과하면 전체 과세.
 * 담배는 궐련 기준(그 외 담배류는 별도 규정), 향수는 용량 기준만 있다.
 */
export const ALCOHOL_ALLOWANCE = { bottles: 2, liters: 2, usd: 400 };
export const TOBACCO_LIMIT_CIGARETTES = 200; // 궐련 기준
export const PERFUME_LIMIT_ML = 100;

/**
 * 여행자 휴대품 주류 세율 (참고용) — 주종별 관세·주세·교육세.
 * 주세: 증류주는 종가 72%(과세가격+관세 기준), 발효주는 30%.
 *      맥주는 종량세(리터당, 매년 물가연동 고시 — RATES_LAST_VERIFIED 기준값).
 * 교육세: 주세율 70% 초과 주종은 주세의 30%, 그 외 10%.
 * 부가세 10%는 계산식(calcAlcoholTax)에서 공통 적용.
 */
export const LIQUOR_TYPES = [
  { id: "spirits", label: "위스키·브랜디 등 증류주", duty: 0.2, liquorRate: 0.72, eduRate: 0.3 },
  { id: "sake", label: "사케(청주)", duty: 0.15, liquorRate: 0.3, eduRate: 0.1 },
  { id: "wine", label: "와인 등 과실주", duty: 0.15, liquorRate: 0.3, eduRate: 0.1 },
  { id: "beer", label: "맥주", duty: 0.3, liquorPerLiter: 885.7, eduRate: 0.3 },
];

/**
 * 여행자 휴대품 간이세율 (관세법 시행령 별표2 기준, 참고용)
 * - 과세대상 물품가격 합계가 USD 1,000 이하면 단일간이세율 20% 선택 가능
 * - calc(overKrw): 면세한도 공제 후 초과금액(원)에 대한 예상 세액
 * - 실제로는 품목별 과세가격 기준·공제 배분 규칙이 있으나 단일 품목 가정으로 단순화
 */
export const TRAVEL_RATES = [
  {
    id: "single20", label: "일반 물품 (단일간이세율 20%)", rateText: "20%",
    calc: (over) => over * 0.2,
    note: "과세대상 물품가격 합계가 미화 1,000달러 이하일 때 품목 구분 없이 적용할 수 있습니다.",
  },
  { id: "etc15", label: "그 밖의 물품 (15%)", rateText: "15%", calc: (over) => over * 0.15 },
  { id: "cloth18", label: "의류·신발·가죽·섬유제품 (18%)", rateText: "18%", calc: (over) => over * 0.18 },
  { id: "fur19", label: "모피의류·모피제품 (19%)", rateText: "19%", calc: (over) => over * 0.19 },
  {
    id: "watchbag45", label: "고급시계·고급가방 (15% + 초과분 45%)", rateText: "15%+45%",
    calc: (over) => (over <= 1_923_000 ? over * 0.15 : 288_450 + (over - 1_923_000) * 0.45),
    note: "과세가격 192.3만원 이하분은 15%, 초과분은 45%가 적용됩니다.",
  },
  {
    id: "jewel45", label: "보석·진주·귀금속 (15% + 초과분 45%)", rateText: "15%+45%",
    calc: (over) => (over <= 4_808_000 ? over * 0.15 : 721_200 + (over - 4_808_000) * 0.45),
    note: "과세가격 480.8만원 이하분은 15%, 초과분은 45%가 적용됩니다.",
  },
  {
    id: "liquor", label: "주류·담배 (간이세율 미적용)", rateText: "별도 세율",
    calc: null,
    note: "주류는 여행자 탭 하단 '별도 면세 품목'에서 주종별 세액을 계산할 수 있습니다. 담배는 담배소비세 등 별도 세율이라 관세청 예상세액 조회를 이용하세요.",
  },
];
