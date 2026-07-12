import { describe, it, expect } from "vitest";
import { buildDeclarationDraft, formatHs } from "../../src/lib/declaration.js";
import { calcCartImportCost } from "../../src/lib/customs.js";
import { CATEGORIES } from "../../src/data/categories.js";
import { getCountry } from "../../src/data/countries.js";

/* 수입신고 초안 단위 테스트 — 계산 결과(calcCartImportCost)의 값이 그대로
   문자열에 들어가는지 검증한다. 테스트 환율: 100엔 = 1,000원, 1달러 = 1,000원 */

const cat = (id) => CATEGORIES.find((c) => c.id === id);
const JP = getCountry("JP");

describe("formatHs", () => {
  it("10자리는 관세율표 표기로, 그 외는 그대로", () => {
    expect(formatHs("8471300000")).toBe("8471.30-0000");
    expect(formatHs("847130")).toBe("847130");
  });
});

describe("buildDeclarationDraft", () => {
  const shop = calcCartImportCost({
    items: [{ priceJpy: 20000, cat: cat("hobby") }],
    localShipJpy: 0, intlShipKrw: 10000,
    jpyKrw: 10, usdKrw: 1000, deMinimisUsd: 150,
  });

  it("환율·품목·세액이 계산 결과 그대로 들어간다", () => {
    const draft = buildDeclarationDraft({ shop, country: JP, rate: 10, hsList: [null], date: "2026-07-12" });
    expect(draft).toContain("[수입신고 참고 정보] 2026-07-12");
    expect(draft).toContain("출발국: 일본 (통화 JPY)");
    expect(draft).toContain("적용 환율: 1,000원/100엔");
    expect(draft).toContain("1. 피규어 · 게임 · 취미용품 · ¥20,000 · 관세율 8%");
    expect(draft).not.toContain("HS "); // 부호 없는 품목엔 HS 표기가 없다
    expect(draft).toContain("물품가격(상품+현지 배송·수수료): ¥20,000 = 200,000원");
    expect(draft).toContain("국제 운임: 10,000원");
    expect(draft).toContain("과세가격(물품+국제운임): 210,000원");
    expect(draft).toContain("관세: 16,800원");
    expect(draft).toContain("부가가치세: 22,680원");
    expect(draft).toContain("예상 세액 합계: 39,480원");
    expect(draft).toContain("최종 예상 비용: 249,480원");
    expect(draft).not.toContain("개별소비세"); // 0원 세목은 생략
  });

  it("HS부호가 있으면 관세율표 표기로 품목 줄에 붙는다", () => {
    const hsShop = calcCartImportCost({
      items: [{ priceJpy: 20000, cat: cat("hobby"), dutyRate: 0 }],
      localShipJpy: 0, intlShipKrw: 0,
      jpyKrw: 10, usdKrw: 1000, deMinimisUsd: 150,
    });
    const draft = buildDeclarationDraft({ shop: hsShop, country: JP, rate: 10, hsList: ["8471300000"], date: "2026-07-12" });
    expect(draft).toContain("HS 8471.30-0000");
    expect(draft).toContain("관세율 0%");
  });

  it("개별소비세 대상(가방 고액)은 개소세·교육세 줄이 생긴다", () => {
    const luxShop = calcCartImportCost({
      items: [{ priceJpy: 300000, cat: cat("bag") }],
      localShipJpy: 0, intlShipKrw: 0,
      jpyKrw: 10, usdKrw: 1000, deMinimisUsd: 150,
    });
    const draft = buildDeclarationDraft({ shop: luxShop, country: JP, rate: 10, hsList: [null], date: "2026-07-12" });
    expect(draft).toContain("개별소비세: ");
    expect(draft).toContain("교육세: ");
  });
});
