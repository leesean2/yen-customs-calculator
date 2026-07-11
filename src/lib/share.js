/**
 * 계산 결과 공유 — 직구 탭 입력값을 URL 쿼리에 담아, 링크를 받은 사람이
 * 같은 계산을 그대로 재현할 수 있게 한다.
 * 환율(j·u)도 함께 담는다: 받은 시점의 실시간 환율로 계산하면 보낸 사람이
 * 본 결과와 달라지므로, 공유 링크는 '보낸 시점의 계산 스냅샷'이어야 한다.
 * 판매자·상품명은 개인 기록이므로 의도적으로 담지 않는다.
 *
 * 파라미터: p 상품가격(출발국 통화) · l 현지 배송비(출발국 통화) · i 국제 배송비(₩)
 *          c 품목 id · o 출발국 id · j 환율(원/100엔) · u 환율(원/달러)
 *          r 출발국 환율(원/1단위) — JPY·USD 외 통화만. JPY·USD는 j·u가 스냅샷 역할.
 *          it 장바구니(상품 2개 이상일 때만) — "가격:품목id" 콤마 목록.
 *             p·c는 첫 상품으로도 채워, it를 모르는 구버전도 부분 재현은 된다.
 */
const MAX_CART_ITEMS = 10;
import { CATEGORIES } from "../data/categories.js";
import { ORIGIN_COUNTRIES } from "../data/countries.js";

/** 주소창 쿼리에서 공유 입력값을 읽는다. 공유 링크가 아니면 null */
export function readShareParams(search = window.location.search) {
  const q = new URLSearchParams(search);
  if (!q.has("p")) return null;
  const numStr = (k) => {
    const v = parseFloat(q.get(k) ?? "");
    return Number.isFinite(v) && v >= 0 ? String(v) : null;
  };
  const cat = q.get("c");
  const origin = q.get("o");
  // it: "가격:품목id,..." — 형식이 어긋난 항목은 버리고, 유효 항목만 장바구니로 복원
  const it = (q.get("it") ?? "")
    .split(",")
    .slice(0, MAX_CART_ITEMS)
    .map((pair) => {
      const [p, c] = pair.split(":");
      const v = parseFloat(p);
      return Number.isFinite(v) && v >= 0 && CATEGORIES.some((x) => x.id === c)
        ? { p: String(v), c }
        : null;
    })
    .filter(Boolean);
  return {
    p: numStr("p"),
    l: numStr("l"),
    i: numStr("i"),
    c: CATEGORIES.some((x) => x.id === cat) ? cat : null,
    o: ORIGIN_COUNTRIES.some((x) => x.id === origin) ? origin : null,
    it: it.length > 1 ? it : null, // 1개면 p·c 경로와 동일하므로 굳이 쓰지 않는다
    j: numStr("j"), // 원/100엔 — 입력란 표기와 같은 단위
    u: numStr("u"),
    r: numStr("r"), // 원/1단위 — 출발국 통화(EUR·CNY 등)
  };
}

/** 현재 입력값으로 공유 URL 생성 (jr은 내부 단위인 1엔당 원화로 받는다)
 *  items: [{ price, catId }] — 첫 상품은 p·c로, 2개 이상이면 전체를 it로도 담는다
 *  originRate: JPY·USD 외 출발국의 원/1단위 환율 — 해당될 때만 r로 담는다 */
export function buildShareUrl({ items, localShip, intlShip, countryId, jr, ur, originRate }) {
  const q = new URLSearchParams({
    p: String(parseFloat(items[0]?.price) || 0),
    l: String(parseFloat(localShip) || 0),
    i: String(parseFloat(intlShip) || 0),
    c: items[0]?.catId ?? "hobby",
    o: countryId,
    j: String(+(jr * 100).toFixed(2)),
    u: String(ur),
  });
  if (items.length > 1) {
    q.set("it", items.slice(0, MAX_CART_ITEMS)
      .map((x) => `${parseFloat(x.price) || 0}:${x.catId}`).join(","));
  }
  if (originRate) q.set("r", String(+originRate.toFixed(2)));
  return `${window.location.origin}${window.location.pathname}?${q.toString()}`;
}
