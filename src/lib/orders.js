/**
 * 구매 이력 저장소 (localStorage) — 합산과세 추적용
 * 같은 판매자에게 같은 날 주문한 물품은 합산 과세될 수 있으므로,
 * 최근 주문(날짜·판매자·물품가격)을 이 브라우저에 기록해 두고 경고에 사용한다.
 */
const KEY = "yen-calc:orders:v1";
const MAX_ORDERS = 50;
const RETENTION_DAYS = 60;

/** 로컬 시간대 기준 YYYY-MM-DD */
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function cutoffStr() {
  const d = new Date(Date.now() - RETENTION_DAYS * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function loadOrders() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const cutoff = cutoffStr();
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    // 오래된 기록은 읽을 때 정리
    return list.filter((o) => o?.id && o?.date >= cutoff && o?.seller && o?.goodsJpy > 0);
  } catch {
    return [];
  }
}

export function saveOrders(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ORDERS)));
  } catch { /* storage 불가 환경은 무시 */ }
}

export function newOrderId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
