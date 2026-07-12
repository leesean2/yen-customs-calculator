import { describe, it, expect, beforeEach } from "vitest";
import { PAYMENT_METHODS, loadPaymentRates, savePaymentRates, paymentRows } from "../../src/lib/payment.js";

/* 결제 수단 수수료 단위 테스트 — 수수료는 외화 결제 금액에만 붙고,
   저장 요율은 화이트리스트·범위 검증을 거친다 */

// node 환경에는 localStorage가 없다 — 최소 스텁
let store;
beforeEach(() => {
  store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
  };
});

describe("paymentRows", () => {
  it("수수료 = 외화 금액 × 요율, 최종 = finalKrw + 수수료, 최저 표시", () => {
    const rows = paymentRows({ foreignKrw: 100_000, finalKrw: 130_000 });
    const credit = rows.find((r) => r.id === "credit");
    const travel = rows.find((r) => r.id === "travel");
    expect(credit.feeKrw).toBeCloseTo(1_400); // 기본 1.4%
    expect(credit.totalKrw).toBeCloseTo(131_400);
    expect(credit.cheapest).toBe(false);
    expect(travel.feeKrw).toBe(0);
    expect(travel.totalKrw).toBe(130_000);
    expect(travel.cheapest).toBe(true);
  });

  it("내 요율이 기본값을 덮어쓰고 custom 표시가 붙는다", () => {
    const rows = paymentRows({ foreignKrw: 100_000, finalKrw: 100_000, rates: { credit: 2 } });
    const credit = rows.find((r) => r.id === "credit");
    expect(credit.pct).toBe(2);
    expect(credit.custom).toBe(true);
    expect(credit.feeKrw).toBeCloseTo(2_000);
  });
});

describe("loadPaymentRates — 저장값 검증", () => {
  it("저장·재로드 왕복", () => {
    savePaymentRates({ credit: 1.1 });
    expect(loadPaymentRates()).toEqual({ credit: 1.1 });
  });

  it("모르는 수단 id·범위 밖·비수치 값은 버린다", () => {
    store["yen-calc:payment-rates:v1"] = JSON.stringify({
      credit: 25, check: -1, travel: "abc", hacked: 1,
    });
    expect(loadPaymentRates()).toEqual({});
  });

  it("손상 JSON이면 빈 객체", () => {
    store["yen-calc:payment-rates:v1"] = "{broken";
    expect(loadPaymentRates()).toEqual({});
  });
});

describe("PAYMENT_METHODS", () => {
  it("기본 요율은 검증 범위 안", () => {
    for (const m of PAYMENT_METHODS) {
      expect(m.defaultPct).toBeGreaterThanOrEqual(0);
      expect(m.defaultPct).toBeLessThanOrEqual(20);
    }
  });
});
