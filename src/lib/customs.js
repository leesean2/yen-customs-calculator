import {
  DUTY_FREE_LIMIT_USD,
  LUXURY_SCT_BASE,
  TRAVELER_LIMIT_USD,
} from "../data/categories.js";

/**
 * 직구 관부가세 계산 (직구 탭·가격비교 탭 공용)
 * - 물품가격(상품가 + 현지 배송비)이 소액면세 한도(미화) 이하면 면세, 초과 시 전체 과세
 * - 과세가격 = 물품가격 + 국제운임
 *
 * 통화 일반화: priceJpy/jpyKrw는 '출발국 상품 통화'와 그 원화 환율이다(엔이 기본).
 * deMinimisUsd는 출발국별 소액면세 한도 — 기본값은 일본(150), 미국이면 200 등
 * (출발국별 값은 data/countries.js). usdKrw는 한도 환산용 USD 환율로 항상 필요.
 */
export function calcImportCost({
  priceJpy, localShipJpy = 0, intlShipKrw = 0, cat, jpyKrw, usdKrw,
  deMinimisUsd = DUTY_FREE_LIMIT_USD,
}) {
  const goodsJpy = (priceJpy || 0) + (localShipJpy || 0);
  const goodsKrw = goodsJpy * (jpyKrw || 0);
  const goodsUsd = usdKrw ? goodsKrw / usdKrw : NaN;
  const intl = intlShipKrw || 0;

  const overLimit = usdKrw ? goodsUsd > deMinimisUsd : false;
  const taxed = overLimit || !!cat.excluded;

  let duty = 0, sct = 0, edu = 0, vat = 0, taxable = 0;
  if (taxed) {
    taxable = goodsKrw + intl;
    duty = taxable * cat.duty;
    if (cat.luxury && taxable + duty > LUXURY_SCT_BASE) {
      sct = (taxable + duty - LUXURY_SCT_BASE) * 0.2;
      edu = sct * 0.3;
    }
    vat = cat.vatExempt ? 0 : (taxable + duty + sct + edu) * 0.1;
  }
  const totalTax = duty + sct + edu + vat;
  return {
    cat, goodsJpy, goodsKrw, goodsUsd, intl, overLimit, taxed,
    taxable, duty, sct, edu, vat, totalTax,
    final: goodsKrw + intl + totalTax,
  };
}

/**
 * 여행자 휴대품 세금 계산 (여행자 탭·직구vs여행 비교 탭 공용)
 * - 면세한도는 USD 800, 초과분에만 간이세율 과세 (직구와 달리 초과분 과세)
 * - rate: TRAVEL_RATES 항목 { id, calc(over), ... }. calc이 없으면(주류·담배) 특례로 계산 불가
 * - selfReport: 자진신고 시 세액 30% 감면(최대 20만원). 특례 품목은 감면 미적용
 */
export function calcTravelTax({ totalJpy, jpyKrw, usdKrw, rate, selfReport }) {
  const totalKrw = (totalJpy || 0) * (jpyKrw || 0);
  const totalUsd = usdKrw ? totalKrw / usdKrw : NaN;
  const limitKrw = TRAVELER_LIMIT_USD * (usdKrw || 0);
  const over = Math.max(0, totalKrw - limitKrw);
  const overUsd = usdKrw ? over / usdKrw : NaN;
  const taxed = usdKrw ? over > 0 : false;
  const special = !rate.calc; // 주류·담배 — 간이세율 미적용
  // 단일간이세율(20%)은 과세대상 합계 USD 1,000 이하일 때만 선택 가능
  const singleLimitOver = rate.id === "single20" && overUsd > 1000;
  const tax = taxed && rate.calc ? rate.calc(over) : 0;
  const discount = taxed && !special && selfReport ? Math.min(tax * 0.3, 200_000) : 0;
  return {
    rate, totalKrw, totalUsd, limitKrw, over, overUsd,
    taxed, special, singleLimitOver, tax, discount, finalTax: tax - discount,
    final: totalKrw + (tax - discount),
  };
}
