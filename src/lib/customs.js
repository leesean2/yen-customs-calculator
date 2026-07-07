import {
  DUTY_FREE_LIMIT_USD,
  LUXURY_SCT_BASE,
} from "../data/categories.js";

/**
 * 일본발 직구 관부가세 계산 (직구 탭·가격비교 탭 공용)
 * - 물품가격(상품가 + 일본 내 배송비)이 USD 150 이하면 면세, 초과 시 전체 과세
 * - 과세가격 = 물품가격 + 국제운임
 */
export function calcImportCost({ priceJpy, localShipJpy = 0, intlShipKrw = 0, cat, jpyKrw, usdKrw }) {
  const goodsJpy = (priceJpy || 0) + (localShipJpy || 0);
  const goodsKrw = goodsJpy * (jpyKrw || 0);
  const goodsUsd = usdKrw ? goodsKrw / usdKrw : NaN;
  const intl = intlShipKrw || 0;

  const overLimit = usdKrw ? goodsUsd > DUTY_FREE_LIMIT_USD : false;
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
