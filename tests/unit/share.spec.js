import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readShareParams, buildShareUrl } from "../../src/lib/share.js";

/* 공유 링크 파싱·생성 단위 테스트 — 특히 it(장바구니) 파라미터의
   "가격:품목id[:hs부호:세율%]" 형식과 구/신 형식 호환을 검증한다 */

beforeAll(() => {
  // buildShareUrl이 주소창 기준으로 URL을 만들므로 node 환경에서 창을 흉내낸다
  globalThis.window = { location: { origin: "https://yen.test", pathname: "/" } };
});
afterAll(() => {
  delete globalThis.window;
});

describe("readShareParams — it(장바구니) 파싱", () => {
  it("구형식(가격:품목id)은 hs 없이 복원된다", () => {
    const r = readShareParams("?p=1000&it=1000:hobby,2000:clothing");
    expect(r.it).toEqual([{ p: "1000", c: "hobby" }, { p: "2000", c: "clothing" }]);
  });

  it("hs 세그먼트가 있으면 hs부호·세율이 함께 복원된다 — 세율 0%도 유효", () => {
    const r = readShareParams("?p=1000&it=1000:hobby:8471300000:0,2000:clothing:6109100000:13");
    expect(r.it).toEqual([
      { p: "1000", c: "hobby", hs: "8471300000", d: 0 },
      { p: "2000", c: "clothing", hs: "6109100000", d: 13 },
    ]);
  });

  it("hs부호가 10자리 숫자가 아니거나 세율이 이상하면 hs만 버리고 상품은 살린다", () => {
    const r = readShareParams("?p=1000&it=1000:hobby:847130000:8,2000:clothing:8471300000:-1");
    expect(r.it).toEqual([{ p: "1000", c: "hobby" }, { p: "2000", c: "clothing" }]);
  });

  it("형식이 어긋난 상품(음수 가격·없는 품목id)은 항목 단위로 버린다", () => {
    const r = readShareParams("?p=1000&it=abc:hobby,1000:nope,-5:hobby,3000:hobby");
    expect(r.it).toEqual([{ p: "3000", c: "hobby" }]);
  });

  it("hs 세율이 붙어 있으면 상품 1개여도 it 경로로 복원한다", () => {
    const r = readShareParams("?p=1000&it=1000:hobby:8471300000:8");
    expect(r.it).toEqual([{ p: "1000", c: "hobby", hs: "8471300000", d: 8 }]);
  });
});

describe("buildShareUrl — it(장바구니) 생성", () => {
  const base = { localShip: "0", intlShip: "0", countryId: "JP", jr: 9.5, ur: 1400 };

  it("상품 1개·hs 없음이면 it를 만들지 않는다 (p·c로 충분)", () => {
    const url = buildShareUrl({ ...base, items: [{ price: "1000", catId: "hobby", hsRate: null }] });
    expect(new URL(url).searchParams.has("it")).toBe(false);
  });

  it("상품 1개라도 hs 세율이 적용돼 있으면 it에 스냅샷을 담는다", () => {
    const url = buildShareUrl({
      ...base,
      items: [{ price: "1000", catId: "hobby", hsRate: { hs: "8471300000", rate: 8 } }],
    });
    expect(new URL(url).searchParams.get("it")).toBe("1000:hobby:8471300000:8");
  });

  it("생성 → 파싱 왕복이 hs 포함/미포함 상품을 그대로 보존한다", () => {
    const url = buildShareUrl({
      ...base,
      items: [
        { price: "1000", catId: "hobby", hsRate: { hs: "8471300000", rate: 0 } },
        { price: "2000", catId: "clothing", hsRate: null },
      ],
    });
    const r = readShareParams(new URL(url).search);
    expect(r.it).toEqual([
      { p: "1000", c: "hobby", hs: "8471300000", d: 0 },
      { p: "2000", c: "clothing" },
    ]);
  });
});
