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

/* ── 내보내기 / 가져오기 — localStorage 전용 저장소라 브라우저를 바꾸면
   이력이 사라지므로, JSON 파일 백업·복원 경로를 제공한다 ── */

/** 이력을 내보내기용 JSON 문자열로 직렬화 */
export function exportOrders(list) {
  return JSON.stringify(
    { app: "yen-calc", kind: "orders", version: 1, exportedAt: new Date().toISOString(), orders: list },
    null, 2
  );
}

/**
 * 가져온 JSON 텍스트를 파싱·검증해 주문 배열로 반환 (형식 오류는 throw)
 * loadOrders와 같은 규칙으로 거른다 — 보존기간(60일) 밖·필수 필드 누락은 제외,
 * 필드는 화이트리스트로만 복사해 저장소에 임의 데이터가 들어오지 않게 한다.
 */
export function parseImportedOrders(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data?.orders;
  if (!Array.isArray(list)) throw new Error("주문 목록이 없습니다");
  const cutoff = cutoffStr();
  return list
    .filter((o) =>
      o?.id && typeof o.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(o.date) &&
      o.date >= cutoff && o?.seller && o?.goodsJpy > 0
    )
    .map((o) => ({
      id: String(o.id),
      date: o.date.slice(0, 10),
      seller: String(o.seller).slice(0, 80),
      item: String(o.item ?? "").slice(0, 120),
      country: typeof o.country === "string" ? o.country.slice(0, 2) : "JP",
      goodsJpy: +o.goodsJpy,
      taxKrw: +o.taxKrw > 0 ? +o.taxKrw : 0,
      finalKrw: +o.finalKrw > 0 ? +o.finalKrw : 0,
    }));
}

/** 기존 이력과 병합 — id 중복은 기존 우선, 날짜 내림차순, 최대 개수 유지 */
export function mergeOrders(current, imported) {
  const seen = new Set(current.map((o) => o.id));
  const merged = [...current, ...imported.filter((o) => !seen.has(o.id))];
  merged.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return merged.slice(0, MAX_ORDERS);
}
