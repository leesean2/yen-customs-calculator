import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { estimateShipping, loadCustomShipRates, saveCustomShipRates } from "../../src/lib/shipping.js";
import { SHIPPING_RATES } from "../../src/data/shipping.js";

/* 배대지 배송비 추정 단위 테스트 — 청구 무게(실무게 vs 부피무게 큰 쪽,
   0.5kg 올림)와 대표 요율(첫 0.5kg base + 0.5kg당 step) 적용을 검증한다 */

const jp = SHIPPING_RATES.JP;
const est = (over = {}) => estimateShipping({ countryId: "JP", weightKg: 0, w: 0, l: 0, h: 0, ...over });

describe("estimateShipping — 청구 무게 산정", () => {
  it("실무게는 0.5kg 단위로 올림된다 — 0.6kg → 1.0kg 청구", () => {
    expect(est({ weightKg: 0.5 }).billedKg).toBe(0.5);
    expect(est({ weightKg: 0.6 }).billedKg).toBe(1);
    expect(est({ weightKg: 1.2 }).billedKg).toBe(1.5);
  });

  it("부동소수 잔차로 한 단계 더 올림되지 않는다 — 0.1×3 = 0.30000000000000004kg", () => {
    expect(est({ weightKg: 0.1 * 3 }).billedKg).toBe(0.5);
  });

  it("부피무게(가로×세로×높이÷6000)가 실무게보다 크면 부피무게로 청구", () => {
    // 30×40×20 = 24,000cm³ → 4kg > 실무게 1kg
    const r = est({ weightKg: 1, w: 30, l: 40, h: 20 });
    expect(r.volumeKg).toBe(4);
    expect(r.volumeApplied).toBe(true);
    expect(r.billedKg).toBe(4);
    // 실무게가 더 크면 실무게 유지
    const r2 = est({ weightKg: 5, w: 30, l: 40, h: 20 });
    expect(r2.volumeApplied).toBe(false);
    expect(r2.billedKg).toBe(5);
  });

  it("치수가 하나라도 빠지면 부피무게 없이 실무게만 쓴다", () => {
    const r = est({ weightKg: 1, w: 30, l: 40, h: 0 });
    expect(r.volumeKg).toBe(0);
    expect(r.billedKg).toBe(1);
  });

  it("실무게·부피무게 모두 없거나 출발국 요율이 없으면 null", () => {
    expect(est()).toBeNull();
    expect(est({ weightKg: -1 })).toBeNull();
    expect(estimateShipping({ countryId: "XX", weightKg: 1 })).toBeNull();
  });
});

describe("estimateShipping — 요율 적용", () => {
  it("첫 0.5kg는 base, 이후 0.5kg마다 step이 붙는다", () => {
    expect(est({ weightKg: 0.5 }).costKrw).toBe(jp.base);
    expect(est({ weightKg: 1.2 }).costKrw).toBe(jp.base + 2 * jp.step); // 1.5kg 청구
  });

  it("출발국별 요율이 다르게 적용된다", () => {
    for (const id of ["JP", "US", "EU", "CN"]) {
      expect(estimateShipping({ countryId: id, weightKg: 0.5 }).costKrw).toBe(SHIPPING_RATES[id].base);
    }
  });

  it("30kg 초과는 overMaxKg로 표시된다 (분할 배송 경고용)", () => {
    expect(est({ weightKg: 30 }).overMaxKg).toBe(false);
    expect(est({ weightKg: 30.1 }).overMaxKg).toBe(true);
  });

  it("rate 오버라이드(내 요율)가 있으면 대표 요율 대신 적용된다", () => {
    const r = est({ weightKg: 1.2, rate: { base: 6000, step: 1000 } }); // 1.5kg 청구
    expect(r.costKrw).toBe(6000 + 2 * 1000);
    // step 0(추가요금 없는 정액제)도 유효
    expect(est({ weightKg: 5, rate: { base: 9900, step: 0 } }).costKrw).toBe(9900);
  });
});

describe("내 배대지 요율 저장소", () => {
  const store = new Map();
  beforeAll(() => {
    globalThis.localStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
    };
  });
  afterAll(() => { delete globalThis.localStorage; });
  beforeEach(() => store.clear());
  const KEY = "yen-calc:ship-rates:v1";

  it("알려진 출발국의 유효한 요율(base>0, step≥0)만 살린다", () => {
    store.set(KEY, JSON.stringify({
      JP: { base: 6000, step: 1000 },
      US: { base: -1, step: 500 },  // base 무효
      EU: "문자열",                  // 형식 무효
      XX: { base: 1, step: 1 },      // 없는 출발국
    }));
    expect(loadCustomShipRates()).toEqual({ JP: { base: 6000, step: 1000 } });
  });

  it("저장소가 비었거나 손상이면 빈 객체", () => {
    expect(loadCustomShipRates()).toEqual({});
    store.set(KEY, "{broken");
    expect(loadCustomShipRates()).toEqual({});
    store.set(KEY, JSON.stringify([1, 2]));
    expect(loadCustomShipRates()).toEqual({});
  });

  it("저장 → 로드 왕복이 보존된다", () => {
    saveCustomShipRates({ CN: { base: 5000, step: 800 } });
    expect(loadCustomShipRates()).toEqual({ CN: { base: 5000, step: 800 } });
  });
});
