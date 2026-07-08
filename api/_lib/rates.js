/**
 * 서버 측 환율 조회 (live-rate API·크론 공용)
 * - 네이버 금융(하나은행 고시): 장중 수 분 단위 갱신 — 1순위
 * - open.er-api.com / frankfurter: 일 1회 갱신 — 폴백·교차 검증용
 */
const UA = { "user-agent": "Mozilla/5.0 (yen-calc rate checker)" };

export async function fromNaverFinance() {
  const get = async (pair, unit) => {
    const url =
      `https://m.search.naver.com/p/csearch/content/qapirender.nhn` +
      `?key=calculator&pkid=141&q=%ED%99%98%EC%9C%A8&where=m&u1=keb&u2=${pair}&u3=${unit}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers: UA });
    if (!r.ok) throw new Error(`naver ${r.status}`);
    const d = await r.json();
    const v = parseFloat(String(d?.country?.[1]?.value ?? "").replace(/,/g, ""));
    if (!v || !isFinite(v)) throw new Error("naver 형식 오류");
    return v;
  };
  const [jpy100, usd] = await Promise.all([get("JPYKRW", 100), get("USDKRW", 1)]);
  return { jpyKrw: jpy100 / 100, usdKrw: usd, source: "하나은행 고시 (네이버 금융)" };
}

export async function fromErApi() {
  const r = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`er-api ${r.status}`);
  const d = await r.json();
  if (d.result !== "success" || !d.rates?.KRW || !d.rates?.JPY) throw new Error("er-api 형식 오류");
  return { jpyKrw: d.rates.KRW / d.rates.JPY, usdKrw: d.rates.KRW, source: "open.er-api.com" };
}

export async function fromFrankfurter() {
  const r = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW,JPY", { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`frankfurter ${r.status}`);
  const d = await r.json();
  if (!d.rates?.KRW || !d.rates?.JPY) throw new Error("frankfurter 형식 오류");
  return { jpyKrw: d.rates.KRW / d.rates.JPY, usdKrw: d.rates.KRW, source: "frankfurter.dev (ECB)" };
}

/** 성공한 소스만 반환 (1순위: 네이버/하나은행) */
export async function fetchAllSources() {
  const results = await Promise.allSettled([fromNaverFinance(), fromErApi(), fromFrankfurter()]);
  return results.filter((r) => r.status === "fulfilled").map((r) => r.value);
}

export function median(nums) {
  if (!nums.length) return NaN;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
