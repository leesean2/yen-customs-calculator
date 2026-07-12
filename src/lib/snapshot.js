import { readShareParams } from "./share.js";
import { calcCartImportCost } from "./customs.js";
import { CATEGORIES } from "../data/categories.js";
import { getCountry } from "../data/countries.js";

/**
 * 공유/저장함 쿼리 스냅샷 재계산 — 페이지 이동 없이 저장 당시의 입력값·환율로
 * 계산 결과를 되살린다(저장함 비교 보기용). 페이지를 여는 복원 경로(ShopTab의
 * shared 처리)와 같은 파라미터 해석을 쓰되, 화면 상태를 만들지 않는 순수 함수.
 * 반환: { country, rate, ur, items, localShipJpy, intlShipKrw, shop } | null
 */
export function computeSnapshot(query) {
  const p = readShareParams(query);
  if (!p) return null;
  const country = getCountry(p.o ?? "JP");
  const jr = (parseFloat(p.j) || 0) / 100; // 원/100엔 → 1엔당
  const ur = parseFloat(p.u) || 0;
  const rate =
    country.currency === "JPY" ? jr
    : country.currency === "USD" ? ur
    : parseFloat(p.r) || 0;

  const fallbackCat = CATEGORIES.find((c) => c.id === "hobby");
  const items = (p.it?.length ? p.it : [{ p: p.p, c: p.c ?? "hobby" }]).map((x) => ({
    priceJpy: parseFloat(x.p) || 0,
    cat: CATEGORIES.find((c) => c.id === x.c) ?? fallbackCat,
    dutyRate: x.hs ? x.d / 100 : undefined,
  }));
  const localShipJpy = parseFloat(p.l) || 0;
  const intlShipKrw = parseFloat(p.i) || 0;

  const shop = calcCartImportCost({
    items, localShipJpy, intlShipKrw,
    jpyKrw: rate, usdKrw: ur,
    deMinimisUsd: country.deMinimisUsd,
  });
  return { country, rate, ur, items, localShipJpy, intlShipKrw, shop };
}

/**
 * 선택 스냅샷들을 '한 주문으로 합산과세될 때'로 재계산 — 같은 출발국일 때만
 * (통화가 섞이면 단일 환율 환산이 불가능하다). 배송비는 각자 그대로 내는
 * 전제라 합산하고, 환율은 첫 스냅샷(호출부가 최신순으로 준다) 것을 쓴다.
 * 출발국이 섞였으면 null.
 */
export function computeCombined(snapshots) {
  if (!snapshots.length) return null;
  const first = snapshots[0];
  if (!snapshots.every((s) => s.country.id === first.country.id)) return null;
  return calcCartImportCost({
    items: snapshots.flatMap((s) => s.items),
    localShipJpy: snapshots.reduce((sum, s) => sum + s.localShipJpy, 0),
    intlShipKrw: snapshots.reduce((sum, s) => sum + s.intlShipKrw, 0),
    jpyKrw: first.rate,
    usdKrw: first.ur,
    deMinimisUsd: first.country.deMinimisUsd,
  });
}
