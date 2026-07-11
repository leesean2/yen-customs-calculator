import { newOrderId, todayStr } from "./orders.js";

/**
 * 계산 저장함 (localStorage) — 직구 탭 계산을 이름 붙여 보관했다가 다시 연다.
 * 저장 항목의 본체는 공유 링크의 쿼리 문자열: 입력값+환율 스냅샷이 이미 그 안에
 * 있으므로(share.js), 불러오기는 그 쿼리로 이동해 공유 링크 복원 경로를 그대로 탄다.
 * 구매 이력(60일 자동 삭제)과 달리 의도적으로 저장한 것이라 만료시키지 않는다.
 */
const KEY = "yen-calc:saved-calcs:v1";
export const MAX_SAVED_CALCS = 20;
const MAX_NAME = 40;
const MAX_QUERY = 2000; // URL 쿼리 상식선 — 비정상적으로 긴 항목은 저장소 오염으로 간주

/** 항목 형식 검증 — 가져온 저장소가 손상돼도 유효 항목만 살린다 */
const valid = (s) =>
  s && typeof s.id === "string" &&
  typeof s.name === "string" && s.name.trim().length > 0 &&
  typeof s.query === "string" && s.query.startsWith("?") && s.query.length <= MAX_QUERY;

export function loadSavedCalcs() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(list)) return [];
    return list.filter(valid).slice(0, MAX_SAVED_CALCS);
  } catch {
    return [];
  }
}

export function saveSavedCalcs(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_SAVED_CALCS)));
  } catch { /* storage 불가 환경은 무시 */ }
}

/** 새 저장 항목 — name이 비면 기본 이름, summary는 목록 표시용 결과 스냅샷 문구 */
export function newSavedCalc({ name, query, summary }) {
  const trimmed = String(name ?? "").trim().slice(0, MAX_NAME);
  return {
    id: newOrderId(),
    name: trimmed || `직구 계산 ${todayStr()}`,
    savedAt: todayStr(),
    query,
    summary: String(summary ?? "").slice(0, 80),
  };
}

/* ── 내보내기 / 가져오기 — 구매 이력(orders.js)과 같은 이유: localStorage
   전용이라 브라우저를 바꾸면 사라지므로 JSON 백업·복원 경로를 제공한다 ── */

/** 저장함을 내보내기용 JSON 문자열로 직렬화 */
export function exportSavedCalcs(list) {
  return JSON.stringify(
    { app: "yen-calc", kind: "saved-calcs", version: 1, exportedAt: new Date().toISOString(), saved: list },
    null, 2
  );
}

/**
 * 가져온 JSON 텍스트를 파싱·검증해 저장 항목 배열로 반환 (형식 오류는 throw)
 * loadSavedCalcs와 같은 valid 규칙으로 거르고, 필드는 화이트리스트로만 복사한다.
 */
export function parseImportedSavedCalcs(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data?.saved;
  if (!Array.isArray(list)) throw new Error("저장함 목록이 없습니다");
  return list.filter(valid).map((s) => ({
    id: String(s.id),
    name: String(s.name).trim().slice(0, MAX_NAME),
    savedAt: typeof s.savedAt === "string" && /^\d{4}-\d{2}-\d{2}/.test(s.savedAt)
      ? s.savedAt.slice(0, 10)
      : todayStr(),
    query: String(s.query),
    summary: String(s.summary ?? "").slice(0, 80),
  }));
}

/** 기존 저장함과 병합 — id 중복은 기존 우선, 저장일 내림차순, 최대 개수 유지 */
export function mergeSavedCalcs(current, imported) {
  const seen = new Set(current.map((s) => s.id));
  const merged = [...current, ...imported.filter((s) => !seen.has(s.id))];
  merged.sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
  return merged.slice(0, MAX_SAVED_CALCS);
}
