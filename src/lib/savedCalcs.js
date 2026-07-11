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
