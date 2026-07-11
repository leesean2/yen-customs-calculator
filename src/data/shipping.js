/**
 * 배대지(배송대행) 국제 배송비 대표 요율 — 출발국별 추정용.
 *
 * 실제 요금은 업체·창고·요금제(항공/선박)마다 다르므로 여기 값은 주요 배대지
 * 요금표를 둘러본 '대표값'이다. 정확한 금액이 아니라 입력 편의를 위한 추정치라는
 * 전제가 UI 문구에 반드시 드러나야 한다. 요율을 최신 요금표와 대조하면
 * SHIPPING_RATES_VERIFIED를 갱신할 것 (categories.js의 세율 검증일과 같은 관례).
 *
 * 모델: 첫 0.5kg = base원, 이후 0.5kg 단위(stepKg)마다 +step원.
 *       청구 무게는 실무게와 부피무게(가로×세로×높이 ÷ 6000) 중 큰 쪽을
 *       0.5kg 단위로 올림 — 배대지 업계 공통 관행.
 */
export const SHIPPING_RATES_VERIFIED = "2026-07-11";

/** 부피무게 환산 제수(cm³/kg) — 항공 특송 표준 6000 */
export const VOLUMETRIC_DIVISOR = 6000;

/** 청구 무게 반올림 단위(kg)와 실무 상한 — 30kg 초과는 대부분 분할 배송 대상 */
export const BILLING_STEP_KG = 0.5;
export const MAX_PARCEL_KG = 30;

export const SHIPPING_RATES = {
  JP: { base: 7000, step: 1200 },
  US: { base: 9000, step: 2300 },
  EU: { base: 10000, step: 2500 },
  CN: { base: 5500, step: 900 },
};
