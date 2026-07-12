import { describe, it, expect } from "vitest";
import { computeSnapshot, computeCombined } from "../../src/lib/snapshot.js";

/* 스냅샷 재계산 단위 테스트 — 저장함 비교가 페이지 복원 경로와 같은 결과를
   내는지, 합산과세 시나리오가 장바구니 계산과 일치하는지 검증한다.
   테스트 환율: 100엔 = 1,000원, 1달러 = 1,000원 */

const JP_RATES = "j=1000&u=1000";

describe("computeSnapshot — 쿼리 → 계산 재현", () => {
  it("일본 단일 상품 — 면세 경계와 최종 비용", () => {
    const s = computeSnapshot(`?p=15000&l=0&i=0&c=hobby&o=JP&${JP_RATES}`);
    expect(s.country.id).toBe("JP");
    expect(s.rate).toBe(10);
    expect(s.shop.taxed).toBe(false);
    expect(s.shop.final).toBeCloseTo(150_000);
  });

  it("장바구니 + HS 세율 스냅샷 — it의 hs 세그먼트가 관세율을 덮어쓴다", () => {
    const s = computeSnapshot(`?p=20000&c=hobby&o=JP&${JP_RATES}&l=0&i=0&it=20000:hobby:8471300000:0`);
    expect(s.shop.taxed).toBe(true);
    expect(s.shop.duty).toBe(0); // HS 0% 적용
    expect(s.shop.vat).toBeCloseTo(20_000);
  });

  it("EUR 출발국 — r(원/1단위) 스냅샷 환율을 쓴다", () => {
    const s = computeSnapshot(`?p=100&l=0&i=0&c=hobby&o=EU&${JP_RATES}&r=1500`);
    expect(s.country.id).toBe("EU");
    expect(s.rate).toBe(1500);
    expect(s.shop.goodsKrw).toBeCloseTo(150_000);
    expect(s.shop.taxed).toBe(false); // $150 = 한도
  });

  it("공유 쿼리가 아니면(p 없음) null", () => {
    expect(computeSnapshot("?x=1")).toBeNull();
  });
});

describe("computeCombined — 합산과세 시나리오", () => {
  const snap = (q) => computeSnapshot(q);

  it("각각 면세인 두 주문이 합치면 과세 — 장바구니 계산과 일치", () => {
    const a = snap(`?p=10000&l=0&i=0&c=hobby&o=JP&${JP_RATES}`);
    const b = snap(`?p=6000&l=0&i=0&c=clothing&o=JP&${JP_RATES}`);
    expect(a.shop.taxed).toBe(false);
    expect(b.shop.taxed).toBe(false);
    const c = computeCombined([a, b]);
    expect(c.taxed).toBe(true);
    // 관세 100,000×8% + 60,000×13% = 15,800 · 부가세 17,580
    expect(c.totalTax).toBeCloseTo(33_380);
    expect(c.final).toBeCloseTo(193_380);
  });

  it("배송비는 각자 그대로 합산된다", () => {
    const a = snap(`?p=10000&l=0&i=3000&c=hobby&o=JP&${JP_RATES}`);
    const b = snap(`?p=6000&l=0&i=2000&c=hobby&o=JP&${JP_RATES}`);
    expect(computeCombined([a, b]).intl).toBe(5000);
  });

  it("출발국이 섞이면 null (통화 혼합 방지)", () => {
    const a = snap(`?p=10000&l=0&i=0&c=hobby&o=JP&${JP_RATES}`);
    const b = snap(`?p=100&l=0&i=0&c=hobby&o=EU&${JP_RATES}&r=1500`);
    expect(computeCombined([a, b])).toBeNull();
    expect(computeCombined([])).toBeNull();
  });
});
