import {
  BILLING_STEP_KG,
  MAX_PARCEL_KG,
  SHIPPING_RATES,
  VOLUMETRIC_DIVISOR,
} from "../data/shipping.js";

/**
 * 배대지 국제 배송비 추정 — 실무게와 부피무게 중 큰 쪽(청구 무게)을
 * 0.5kg 단위로 올림해 대표 요율(첫 0.5kg base + 이후 0.5kg당 step)을 적용한다.
 *
 * weightKg: 실무게(kg) · w/l/h: 상자 치수(cm) — 셋 다 있어야 부피무게를 계산한다
 * (하나라도 빠지면 실무게만 사용: 부피를 모르는 게 보통이라 선택 입력).
 * 반환: { actualKg, volumeKg, billedKg, costKrw, volumeApplied, overMaxKg } | null
 * null: 실무게·부피무게 모두 없어 추정 자체가 불가능할 때.
 */
export function estimateShipping({ countryId, weightKg, w, l, h }) {
  const rate = SHIPPING_RATES[countryId];
  if (!rate) return null;

  const actualKg = weightKg > 0 ? weightKg : 0;
  const dimsOk = w > 0 && l > 0 && h > 0;
  const volumeKg = dimsOk ? (w * l * h) / VOLUMETRIC_DIVISOR : 0;
  if (actualKg <= 0 && volumeKg <= 0) return null;

  const volumeApplied = volumeKg > actualKg;
  const chargeKg = Math.max(actualKg, volumeKg);
  // 부동소수 잔차로 한 단계 더 올림되지 않게 반올림 후 단위 올림 (예: 1.0000000002kg)
  const billedKg = Math.ceil(+(chargeKg / BILLING_STEP_KG).toFixed(6)) * BILLING_STEP_KG;

  const steps = billedKg / BILLING_STEP_KG - 1; // 첫 단위는 base에 포함
  return {
    actualKg,
    volumeKg: +volumeKg.toFixed(2),
    billedKg,
    costKrw: rate.base + steps * rate.step,
    volumeApplied,
    overMaxKg: billedKg > MAX_PARCEL_KG,
  };
}
