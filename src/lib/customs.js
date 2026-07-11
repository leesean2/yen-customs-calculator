import {
  ALCOHOL_ALLOWANCE,
  DUTY_FREE_LIMIT_USD,
  LUXURY_SCT_BASE,
  TRAVELER_LIMIT_USD,
} from "../data/categories.js";

/**
 * 여러 상품 장바구니 직구 계산 — 면세 판정은 '주문 전체 물품가격' 기준이라
 * 품목 각각은 한도 이하라도 합치면 초과할 수 있다(직구에서 가장 흔한 실수).
 * - 과세 시 현지 배송비·국제운임을 상품가 비율로 안분한 품목별 과세가격(base)에
 *   품목별 관세율을 적용하고, 개소세(가방·시계)·부가세 면제(서적)도 품목별로 따진다
 * - 목록통관 배제 품목이 하나라도 있으면 주문 전체가 일반 수입신고 대상 → 전체 과세
 * items: [{ priceJpy, cat, dutyRate? }] — 통화 일반화는 calcImportCost와 동일(엔이 기본).
 *   dutyRate(소수)는 HS부호 조회로 얻은 정확 관세율 — 있으면 cat.duty 대신 쓴다.
 */
export function calcCartImportCost({
  items, localShipJpy = 0, intlShipKrw = 0, jpyKrw, usdKrw,
  deMinimisUsd = DUTY_FREE_LIMIT_USD,
}) {
  const itemsJpy = items.reduce((s, it) => s + (it.priceJpy || 0), 0);
  const goodsJpy = itemsJpy + (localShipJpy || 0);
  const goodsKrw = goodsJpy * (jpyKrw || 0);
  const goodsUsd = usdKrw ? goodsKrw / usdKrw : NaN;
  const intl = intlShipKrw || 0;

  const overLimit = usdKrw ? goodsUsd > deMinimisUsd : false;
  const hasExcluded = items.some((it) => it.cat.excluded);
  const taxed = overLimit || hasExcluded;

  let duty = 0, sct = 0, edu = 0, vat = 0, taxable = 0;
  // 면세여도 품목 구성은 반환한다 — 화면이 상품 수·품목별 표시에 쓴다
  const perItem = items.map((it) => ({
    cat: it.cat, priceJpy: it.priceJpy || 0,
    dutyRate: it.dutyRate ?? it.cat.duty, // HS부호 정확 세율이 있으면 우선
    base: 0, duty: 0, sct: 0, edu: 0, vat: 0,
  }));
  if (taxed) {
    taxable = goodsKrw + intl;
    for (const pi of perItem) {
      // 상품가가 전부 0(현지 배송비만 있는 극단)일 때는 균등 안분해 세액이 사라지지 않게
      const share = itemsJpy > 0 ? pi.priceJpy / itemsJpy : 1 / perItem.length;
      pi.base = taxable * share;
      pi.duty = pi.base * pi.dutyRate;
      if (pi.cat.luxury && pi.base + pi.duty > LUXURY_SCT_BASE) {
        pi.sct = (pi.base + pi.duty - LUXURY_SCT_BASE) * 0.2;
        pi.edu = pi.sct * 0.3;
      }
      pi.vat = pi.cat.vatExempt ? 0 : (pi.base + pi.duty + pi.sct + pi.edu) * 0.1;
      duty += pi.duty; sct += pi.sct; edu += pi.edu; vat += pi.vat;
    }
  }
  const totalTax = duty + sct + edu + vat;
  return {
    items: perItem, itemsJpy, hasExcluded,
    goodsJpy, goodsKrw, goodsUsd, intl, overLimit, taxed,
    taxable, duty, sct, edu, vat, totalTax,
    final: goodsKrw + intl + totalTax,
  };
}

/**
 * 단일 상품 직구 계산 (가격비교·직구여행 비교 탭 공용) — 장바구니 계산의
 * 1개짜리 특수형. 수식이 한 곳(calcCartImportCost)에만 존재하도록 위임한다.
 */
export function calcImportCost({
  priceJpy, localShipJpy = 0, intlShipKrw = 0, cat, jpyKrw, usdKrw,
  deMinimisUsd = DUTY_FREE_LIMIT_USD,
}) {
  const r = calcCartImportCost({
    items: [{ priceJpy, cat }], localShipJpy, intlShipKrw, jpyKrw, usdKrw, deMinimisUsd,
  });
  return { ...r, cat };
}

/**
 * 여행자 휴대품 세금 계산 (여행자 탭·직구vs여행 비교 탭 공용)
 * - 면세한도는 USD 800, 초과분에만 간이세율 과세 (직구와 달리 초과분 과세)
 * - rate: TRAVEL_RATES 항목 { id, calc(over), ... }. calc이 없으면(주류·담배) 특례로 계산 불가
 * - selfReport: 자진신고 시 세액 30% 감면(최대 20만원). 특례 품목은 감면 미적용
 */
/**
 * 여행자 휴대 주류 세금 계산 (별도 면세한도 — 기본 $800과 별개)
 * - 면세 조건: 병수 ≤ 2 · 총 용량 ≤ 2L · 총 금액 ≤ $400을 모두 충족
 * - 하나라도 초과하면 '초과분'이 아닌 술 전체 금액이 과세된다
 * - 세목: 관세 → 주세(증류주 72%·발효주 30% 종가, 맥주는 리터당 종량)
 *        → 교육세(주세의 30% 또는 10%) → 부가세 10%
 * - 자진신고 감면은 간이세율과 달리 세목이 분리되므로 '관세'의 30%만 (한도 20만원)
 */
export function calcAlcoholTax({ bottles, liters, priceJpy, jpyKrw, usdKrw, type, selfReport }) {
  const b = bottles || 0, l = liters || 0;
  const priceKrw = (priceJpy || 0) * (jpyKrw || 0);
  const priceUsd = usdKrw ? priceKrw / usdKrw : NaN;
  const entered = b > 0 || l > 0 || (priceJpy || 0) > 0;

  const overReasons = [
    b > ALCOHOL_ALLOWANCE.bottles && `${ALCOHOL_ALLOWANCE.bottles}병 초과`,
    l > ALCOHOL_ALLOWANCE.liters && `${ALCOHOL_ALLOWANCE.liters}L 초과`,
    (usdKrw ? priceUsd > ALCOHOL_ALLOWANCE.usd : false) && `$${ALCOHOL_ALLOWANCE.usd} 초과`,
  ].filter(Boolean);
  const taxed = entered && overReasons.length > 0;

  let duty = 0, liquor = 0, edu = 0, vat = 0, discount = 0;
  if (taxed) {
    duty = priceKrw * type.duty;
    liquor = type.liquorPerLiter ? l * type.liquorPerLiter : (priceKrw + duty) * type.liquorRate;
    edu = liquor * type.eduRate;
    vat = (priceKrw + duty + liquor + edu) * 0.1;
    discount = selfReport ? Math.min(duty * 0.3, 200_000) : 0;
  }
  const totalTax = duty + liquor + edu + vat;
  return {
    type, entered, priceKrw, priceUsd, overReasons, taxed,
    duty, liquor, edu, vat, discount, totalTax, finalTax: totalTax - discount,
  };
}

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
