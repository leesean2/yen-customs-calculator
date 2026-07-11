import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { loadSavedCalcs, saveSavedCalcs, newSavedCalc, MAX_SAVED_CALCS } from "../../src/lib/savedCalcs.js";

/* 계산 저장함 저장소 단위 테스트 — 손상된 저장소에서 유효 항목만 살리는
   검증 규칙과 이름 기본값·길이 제한을 확인한다 */

// node 환경에는 localStorage가 없다 — 메모리 스텁으로 흉내낸다
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
};
beforeEach(() => store.clear());
afterAll(() => { delete globalThis.localStorage; });

const KEY = "yen-calc:saved-calcs:v1";
const entry = (over = {}) => ({ id: "a1", name: "테스트", query: "?p=1000&c=hobby", ...over });

describe("loadSavedCalcs — 검증", () => {
  it("유효 항목만 살린다 — id·name·query('?'로 시작) 필수", () => {
    store.set(KEY, JSON.stringify([
      entry(),
      entry({ id: 2 }),            // id가 문자열이 아님
      entry({ name: "  " }),       // 공백 이름
      entry({ query: "p=1000" }),  // '?' 누락
      entry({ query: "?" + "x".repeat(2001) }), // 비정상 길이
      "문자열",
    ]));
    const list = loadSavedCalcs();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("a1");
  });

  it("저장소가 비었거나 손상(JSON 오류·배열 아님)이면 빈 배열", () => {
    expect(loadSavedCalcs()).toEqual([]);
    store.set(KEY, "{broken");
    expect(loadSavedCalcs()).toEqual([]);
    store.set(KEY, JSON.stringify({ a: 1 }));
    expect(loadSavedCalcs()).toEqual([]);
  });

  it("최대 개수를 넘는 항목은 잘라낸다", () => {
    store.set(KEY, JSON.stringify(
      Array.from({ length: MAX_SAVED_CALCS + 5 }, (_, i) => entry({ id: `id${i}` }))
    ));
    expect(loadSavedCalcs()).toHaveLength(MAX_SAVED_CALCS);
  });
});

describe("newSavedCalc / saveSavedCalcs", () => {
  it("이름이 비면 날짜 기본 이름, 길면 40자로 자른다", () => {
    expect(newSavedCalc({ name: "  ", query: "?p=1" }).name).toMatch(/^직구 계산 \d{4}-\d{2}-\d{2}$/);
    expect(newSavedCalc({ name: "가".repeat(50), query: "?p=1" }).name).toHaveLength(40);
    expect(newSavedCalc({ name: "x", query: "?p=1", summary: "y".repeat(100) }).summary).toHaveLength(80);
  });

  it("저장 시에도 최대 개수를 넘지 않게 자른다 — 왕복 보존", () => {
    const list = Array.from({ length: MAX_SAVED_CALCS + 3 }, (_, i) => entry({ id: `id${i}` }));
    saveSavedCalcs(list);
    const loaded = loadSavedCalcs();
    expect(loaded).toHaveLength(MAX_SAVED_CALCS);
    expect(loaded[0]).toEqual(entry({ id: "id0", summary: undefined }));
  });
});
