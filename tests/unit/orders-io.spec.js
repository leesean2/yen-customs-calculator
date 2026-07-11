import { describe, it, expect } from "vitest";
import { exportOrders, parseImportedOrders, mergeOrders, todayStr } from "../../src/lib/orders.js";

/* 구매 이력 내보내기/가져오기 순수 함수 — 형식 검증·필드 화이트리스트·병합 규칙 */

const today = todayStr();
const daysAgo = (n) => {
  const d = new Date(Date.now() - n * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const order = (over = {}) => ({
  id: "a1", date: today, seller: "TestShop", item: "", country: "JP", goodsJpy: 8000, taxKrw: 0, finalKrw: 80000, ...over,
});

describe("내보내기 → 가져오기 왕복", () => {
  it("내보낸 JSON을 그대로 가져오면 같은 주문이 복원된다", () => {
    const list = [order(), order({ id: "b2", country: "US", goodsJpy: 150 })];
    expect(parseImportedOrders(exportOrders(list))).toEqual(list);
  });

  it("래퍼 없는 배열 형태도 받아들인다", () => {
    expect(parseImportedOrders(JSON.stringify([order()]))).toHaveLength(1);
  });
});

describe("parseImportedOrders — 검증·정리", () => {
  it("주문 목록이 없으면 throw", () => {
    expect(() => parseImportedOrders("{}")).toThrow();
    expect(() => parseImportedOrders('{"orders": 3}')).toThrow();
  });

  it("보존기간(60일)이 지난 기록과 필수 필드 누락은 걸러진다", () => {
    const list = [
      order(),
      order({ id: "old", date: daysAgo(61) }),
      order({ id: "noseller", seller: "" }),
      order({ id: "zero", goodsJpy: 0 }),
    ];
    const parsed = parseImportedOrders(JSON.stringify({ orders: list }));
    expect(parsed.map((o) => o.id)).toEqual(["a1"]);
  });

  it("필드는 화이트리스트로만 복사되고 country 없는 기록은 일본 취급", () => {
    const raw = [{ ...order(), country: undefined, evil: "<script>", taxKrw: -5 }];
    const [o] = parseImportedOrders(JSON.stringify(raw));
    expect(o.country).toBe("JP");
    expect(o.taxKrw).toBe(0);
    expect("evil" in o).toBe(false);
  });
});

describe("mergeOrders — 병합 규칙", () => {
  it("id 중복은 기존 기록을 유지하고, 날짜 내림차순으로 정렬한다", () => {
    const current = [order({ id: "x", seller: "기존" })];
    const imported = [order({ id: "x", seller: "덮어쓰기시도" }), order({ id: "y", date: daysAgo(1) })];
    const merged = mergeOrders(current, imported);
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe("x"); // 오늘이 어제보다 먼저
    expect(merged[0].seller).toBe("기존");
  });

  it("최대 개수(50)를 넘지 않는다", () => {
    const many = Array.from({ length: 60 }, (_, i) => order({ id: `n${i}` }));
    expect(mergeOrders([], many)).toHaveLength(50);
  });
});
