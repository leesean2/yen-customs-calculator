/**
 * 결제 수단별 해외 결제 수수료 — 같은 주문도 무엇으로 결제하느냐에 따라
 * 최종 지출이 달라진다(일반 신용카드는 브랜드 수수료 + 해외서비스 수수료,
 * 외화 충전식 트래블카드는 대부분 0%).
 * 수수료는 '외화 결제 금액'(물품가+현지 배송·수수료의 원화 환산)에만 붙는다
 * — 국제 배송비(배대지, 원화 청구)와 세금(원화 납부)은 해외 결제가 아니다.
 * 요율 기본값은 대표치이고, 사용자가 자기 카드 요율로 덮어써 저장한다.
 */

export const PAYMENT_METHODS = [
  {
    id: "credit", label: "일반 신용카드", defaultPct: 1.4,
    note: "브랜드 수수료(비자·마스터 1~1.4%) + 해외서비스 수수료(0.25~0.35%) 대표치",
  },
  {
    id: "check", label: "해외겸용 체크카드", defaultPct: 0.7,
    note: "브랜드 수수료 + 건별 해외 인출·이용 수수료 대표치 (카드사별 편차 큼)",
  },
  {
    id: "travel", label: "트래블카드 (외화 충전식)", defaultPct: 0,
    note: "트래블로그·트래블월렛 등 — 주요 통화 환전 우대 100% 기준",
  },
];

const KEY = "yen-calc:payment-rates:v1";
const MAX_PCT = 20; // 수수료율 상한 — 이 이상은 입력 오류로 본다

/** 저장된 내 요율 { 수단id: pct } — 모르는 id·범위 밖 값은 버린다 */
export function loadPaymentRates() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const out = {};
    for (const m of PAYMENT_METHODS) {
      const v = parseFloat(raw[m.id]);
      if (Number.isFinite(v) && v >= 0 && v <= MAX_PCT) out[m.id] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function savePaymentRates(rates) {
  try { localStorage.setItem(KEY, JSON.stringify(rates)); } catch { /* ignore */ }
}

/**
 * 수단별 수수료·최종 비용 행. foreignKrw: 외화 결제 금액(원화 환산),
 * finalKrw: 수수료 전 최종 비용. cheapest는 최저 최종 비용 행 표시(동률 모두).
 */
export function paymentRows({ foreignKrw, finalKrw, rates = {} }) {
  const rows = PAYMENT_METHODS.map((m) => {
    const pct = rates[m.id] ?? m.defaultPct;
    const feeKrw = (foreignKrw || 0) * (pct / 100);
    return { ...m, pct, custom: rates[m.id] != null, feeKrw, totalKrw: (finalKrw || 0) + feeKrw };
  });
  const min = Math.min(...rows.map((r) => r.totalKrw));
  return rows.map((r) => ({ ...r, cheapest: r.totalKrw === min }));
}
