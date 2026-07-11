import { describe, it, expect } from "vitest";
import { calcImportCost, calcCartImportCost, calcTravelTax, calcAlcoholTax } from "../../src/lib/customs.js";
import { CATEGORIES, TRAVEL_RATES, LIQUOR_TYPES } from "../../src/data/categories.js";

/* 세금 계산 순수 함수 단위 테스트 — 경계값은 E2E(브라우저)에도 있지만,
   여기서는 밀리초 단위로 훨씬 촘촘하게 검증한다.
   환율 관례: 1엔 = 10원(100엔 = 1,000원), 1달러 = 1,000원 → $환산 = ¥ ÷ 100 */

const cat = (id) => CATEGORIES.find((c) => c.id === id);
const rate = (id) => TRAVEL_RATES.find((r) => r.id === id);
const liquor = (id) => LIQUOR_TYPES.find((t) => t.id === id);

const shop = (over = {}) =>
  calcImportCost({ priceJpy: 0, intlShipKrw: 0, cat: cat("hobby"), jpyKrw: 10, usdKrw: 1000, ...over });

describe("calcImportCost — 직구 소액면세·세액", () => {
  it("정확히 $150은 면세, $150.01부터 전체 과세", () => {
    expect(shop({ priceJpy: 15000 }).taxed).toBe(false);
    const t = shop({ priceJpy: 15001 });
    expect(t.taxed).toBe(true);
    expect(t.taxable).toBeCloseTo(150_010); // 초과분이 아닌 전체 금액
  });

  it("출발국별 한도 — deMinimisUsd 200이면 $199 면세, $201 과세", () => {
    expect(shop({ priceJpy: 19900, deMinimisUsd: 200 }).taxed).toBe(false);
    expect(shop({ priceJpy: 20100, deMinimisUsd: 200 }).taxed).toBe(true);
  });

  it("현지 배송비는 면세 판정에 포함, 국제 배송비는 제외", () => {
    expect(shop({ priceJpy: 14000, localShipJpy: 1001 }).taxed).toBe(true);
    expect(shop({ priceJpy: 15000, intlShipKrw: 999_999 }).taxed).toBe(false);
  });

  it("목록통관 배제 품목은 금액과 무관하게 과세", () => {
    expect(shop({ priceJpy: 100, cat: cat("health") }).taxed).toBe(true);
  });

  it("개별소비세 — 과세가격+관세 200만원 초과분에만 20% + 교육세 30%", () => {
    const under = shop({ priceJpy: 185185, cat: cat("bag") }); // 1,999,998원
    expect(under.sct).toBe(0);
    const bag = shop({ priceJpy: 200000, cat: cat("bag") }); // 2,160,000원 → 초과 160,000
    expect(bag.duty).toBeCloseTo(160_000);
    expect(bag.sct).toBeCloseTo(32_000);
    expect(bag.edu).toBeCloseTo(9_600);
    expect(bag.vat).toBeCloseTo(220_160);
    expect(bag.totalTax).toBeCloseTo(421_760);
  });

  it("서적 — 과세 대상이어도 관세 0% + 부가세 면제로 세액 0원", () => {
    const book = shop({ priceJpy: 20000, cat: cat("book") });
    expect(book.taxed).toBe(true);
    expect(book.totalTax).toBe(0);
  });

  it("USD 환율이 없으면 면세 판정을 하지 않는다 (0원 과세 방지)", () => {
    expect(shop({ priceJpy: 99999, usdKrw: 0 }).taxed).toBe(false);
  });
});

describe("calcCartImportCost — 장바구니(여러 상품) 합산", () => {
  const cart = (items, over = {}) =>
    calcCartImportCost({ items, intlShipKrw: 0, jpyKrw: 10, usdKrw: 1000, ...over });

  it("각각은 한도 이하라도 합산이 넘으면 전체 과세 — 품목별 관세율 안분", () => {
    // ¥10,000($100) + ¥6,000($60) = $160 > $150
    const r = cart([
      { priceJpy: 10000, cat: cat("hobby") },    // 8%
      { priceJpy: 6000, cat: cat("clothing") },  // 13%
    ]);
    expect(r.taxed).toBe(true);
    expect(r.duty).toBeCloseTo(100_000 * 0.08 + 60_000 * 0.13); // 15,800
    expect(r.vat).toBeCloseTo((160_000 + 15_800) * 0.1);        // 17,580
    expect(r.final).toBeCloseTo(193_380);
  });

  it("부가세 면제(서적)는 해당 품목 안분액에만 적용된다", () => {
    const r = cart([
      { priceJpy: 10000, cat: cat("book") },  // 관세 0 + 부가세 면제
      { priceJpy: 10000, cat: cat("hobby") },
    ]);
    expect(r.duty).toBeCloseTo(8_000);
    expect(r.vat).toBeCloseTo((100_000 + 8_000) * 0.1); // 서적분 제외
  });

  it("목록통관 배제 품목이 섞이면 합산 $150 이하여도 전체 과세", () => {
    const r = cart([
      { priceJpy: 5000, cat: cat("health") },
      { priceJpy: 5000, cat: cat("hobby") },
    ]);
    expect(r.overLimit).toBe(false);
    expect(r.taxed).toBe(true);
    expect(r.totalTax).toBeCloseTo(8_000 + (100_000 + 8_000) * 0.1); // 18,800
  });

  it("국제운임은 상품가 비율로 안분되어 품목별 관세에 반영된다", () => {
    const r = cart(
      [{ priceJpy: 12000, cat: cat("hobby") }, { priceJpy: 4000, cat: cat("clothing") }],
      { intlShipKrw: 16_000 } // 과세가격 176,000 → 안분 132,000 / 44,000
    );
    expect(r.duty).toBeCloseTo(132_000 * 0.08 + 44_000 * 0.13);
  });

  it("단일 상품이면 calcImportCost와 결과가 동일하다 (위임 검증)", () => {
    for (const c of ["hobby", "bag", "book", "health"]) {
      const single = calcImportCost({ priceJpy: 200000, intlShipKrw: 10_000, cat: cat(c), jpyKrw: 10, usdKrw: 1000 });
      const asCart = cart([{ priceJpy: 200000, cat: cat(c) }], { intlShipKrw: 10_000 });
      expect(asCart.taxed, `${c}.taxed`).toBe(single.taxed);
      for (const k of ["taxable", "duty", "sct", "edu", "vat", "totalTax", "final"]) {
        expect(asCart[k], `${c}.${k}`).toBeCloseTo(single[k]);
      }
    }
  });
});

describe("calcTravelTax — 여행자 휴대품", () => {
  const travel = (over = {}) =>
    calcTravelTax({ totalJpy: 0, jpyKrw: 10, usdKrw: 1000, rate: rate("single20"), selfReport: false, ...over });

  it("$800 이하 면세, 초과분에만 간이세율", () => {
    expect(travel({ totalJpy: 80000 }).taxed).toBe(false);
    const t = travel({ totalJpy: 150000 }); // 1,500,000원 → 초과 700,000
    expect(t.over).toBeCloseTo(700_000);
    expect(t.tax).toBeCloseTo(140_000); // 20%
  });

  it("자진신고 감면은 30%, 상한 20만원", () => {
    const small = travel({ totalJpy: 150000, selfReport: true });
    expect(small.discount).toBeCloseTo(42_000);
    const big = travel({ totalJpy: 880000, selfReport: true }); // 초과 800만원 → 세액 160만
    expect(big.discount).toBe(200_000);
  });

  it("단일간이세율은 과세대상 $1,000 '초과'부터 선택 불가 — 정확히 $1,000은 허용", () => {
    expect(travel({ totalJpy: 180001 }).singleLimitOver).toBe(true); // 초과분 $1,000.01
    expect(travel({ totalJpy: 180000 }).singleLimitOver).toBe(false); // 초과분 딱 $1,000
  });

  it("주류·담배(calc 없음)는 special로 표시되고 세액을 내지 않는다", () => {
    const t = travel({ totalJpy: 150000, rate: rate("liquor") });
    expect(t.special).toBe(true);
    expect(t.tax).toBe(0);
  });

  it("고급시계·가방 구간세율 — 기준액 이하 15%, 초과분 45%", () => {
    const t = travel({ totalJpy: 380000, rate: rate("watchbag45") }); // 초과 3,000,000
    expect(t.tax).toBeCloseTo(1_923_000 * 0.15 + (3_000_000 - 1_923_000) * 0.45);
  });
});

describe("calcAlcoholTax — 여행자 주류 별도 면세", () => {
  const alc = (over = {}) =>
    calcAlcoholTax({ bottles: 0, liters: 0, priceJpy: 0, jpyKrw: 10, usdKrw: 1000, type: liquor("spirits"), selfReport: true, ...over });

  it("2병·2L·$400 경계는 면세, 아무 것도 안 넣으면 판정 없음", () => {
    expect(alc({ bottles: 2, liters: 2, priceJpy: 40000 }).taxed).toBe(false);
    expect(alc().entered).toBe(false);
    expect(alc().taxed).toBe(false);
  });

  it("세 조건 각각 단독 초과로도 전체 과세", () => {
    expect(alc({ bottles: 3, liters: 1, priceJpy: 10000 }).overReasons).toEqual(["2병 초과"]);
    expect(alc({ bottles: 1, liters: 2.5, priceJpy: 10000 }).overReasons).toEqual(["2L 초과"]);
    expect(alc({ bottles: 1, liters: 1, priceJpy: 40100 }).overReasons).toEqual(["$400 초과"]);
  });

  it("위스키(증류주) 세목별 세액 — 관세 20% → 주세 72% → 교육세 30% → 부가세 10%", () => {
    const t = alc({ bottles: 3, liters: 2, priceJpy: 40000 }); // 400,000원 전체 과세
    expect(t.duty).toBeCloseTo(80_000);
    expect(t.liquor).toBeCloseTo(345_600);
    expect(t.edu).toBeCloseTo(103_680);
    expect(t.vat).toBeCloseTo(92_928);
    expect(t.discount).toBeCloseTo(24_000); // 관세의 30%
    expect(t.finalTax).toBeCloseTo(598_208);
  });

  it("맥주는 종량 주세(리터당) — 가격이 아닌 용량 기준", () => {
    const t = alc({ liters: 3, priceJpy: 3000, type: liquor("beer") }); // 30,000원, 3L
    expect(t.duty).toBeCloseTo(9_000); // 30%
    expect(t.liquor).toBeCloseTo(3 * 885.7);
    expect(t.discount).toBeCloseTo(2_700);
  });

  it("자진신고 감면은 관세분에만 30% + 상한 20만원", () => {
    const t = alc({ bottles: 3, priceJpy: 1_000_000 }); // 관세 2,000,000 → 30% = 60만 → 상한
    expect(t.discount).toBe(200_000);
    const off = alc({ bottles: 3, priceJpy: 40000, selfReport: false });
    expect(off.discount).toBe(0);
  });
});
