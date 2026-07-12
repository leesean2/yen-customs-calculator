/**
 * 수입신고 참고 정보 초안 — 과세 판정이 난 계산에서 신고(특송업체·관세사 대행)에
 * 필요한 값을 텍스트로 정리한다. 통관 절차 안내의 다음 단계: "신고서에 뭘 적어
 * 보내야 하나"를 계산 결과 그대로 복사해 쓰게 한다.
 * 순수 문자열 생성 함수 — 포맷은 국내 관행(원 콤마, 환율은 표기 단위)을 따른다.
 */

const won = (n) => Math.round(n).toLocaleString("ko-KR") + "원";
const num = (n) => Math.round(n).toLocaleString("ko-KR");

/** "8471300000" → "8471.30-0000" (관세율표 표기) — 10자리가 아니면 그대로 */
export function formatHs(hs) {
  return /^\d{10}$/.test(hs) ? `${hs.slice(0, 4)}.${hs.slice(4, 6)}-${hs.slice(6)}` : hs;
}

/**
 * shop: calcCartImportCost 결과 (taxed 전제 — 면세면 신고 자체가 없다)
 * country: 출발국(data/countries.js) · rate: 1단위당 원 · hsList: shop.items와
 * 같은 순서의 HS부호(없는 품목은 null) · date: 기준일 "YYYY-MM-DD"
 */
export function buildDeclarationDraft({ shop, country, rate, hsList = [], date }) {
  const unitRate =
    (rate * country.rateUnit).toLocaleString("ko-KR", { maximumFractionDigits: 2 }) +
    `원/${country.rateUnit === 1 ? "" : country.rateUnit}${country.rateUnitLabel}`;

  const itemLines = shop.items.map((it, i) => {
    const hs = hsList[i];
    const parts = [
      it.cat.label,
      hs && `HS ${formatHs(hs)}`,
      `${country.symbol}${num(it.priceJpy)}`,
      `관세율 ${Math.round(it.dutyRate * 100)}%`,
    ].filter(Boolean);
    return `${i + 1}. ${parts.join(" · ")}`;
  });

  const taxLines = [
    `관세: ${won(shop.duty)}`,
    shop.sct > 0 && `개별소비세: ${won(shop.sct)}`,
    shop.edu > 0 && `교육세: ${won(shop.edu)}`,
    `부가가치세: ${won(shop.vat)}`,
  ].filter(Boolean);

  return [
    `[수입신고 참고 정보] ${date} · 엔화 직구 계산기`,
    "",
    `출발국: ${country.label} (통화 ${country.currency})`,
    `적용 환율: ${unitRate} — 입력 시점 시세이며, 실제 신고에는 관세청 과세환율이 적용됩니다`,
    "",
    `품목 (${shop.items.length}건)`,
    ...itemLines,
    "",
    `물품가격(상품+현지 배송·수수료): ${country.symbol}${num(shop.goodsJpy)} = ${won(shop.goodsKrw)}`,
    `국제 운임: ${won(shop.intl)}`,
    `과세가격(물품+국제운임): ${won(shop.taxable)}`,
    ...taxLines,
    `예상 세액 합계: ${won(shop.totalTax)}`,
    `최종 예상 비용: ${won(shop.final)}`,
    "",
    "※ 개인통관고유부호(P로 시작하는 13자리)를 신고서에 기재해야 합니다.",
    "※ 실제 세액은 통관 시점의 관세청 과세환율과 세관 심사에 따라 달라질 수 있습니다.",
  ].join("\n");
}
