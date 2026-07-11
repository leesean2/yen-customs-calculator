/**
 * 서버 측 환율 조회 (live-rate API·크론 공용)
 * - manana.kr / Yahoo Finance: 실시간 시세(수 분 단위) — 1·2순위
 * - open.er-api.com / frankfurter: 일 1회 갱신 — 폴백·교차 검증용
 *
 * 반환: { jpyKrw, usdKrw, krwPer, source }
 * krwPer는 통화→원/1단위 맵(JPY·USD 필수, EUR·CNY는 소스가 주면 포함) —
 * 직구 출발국 확장용. jpyKrw/usdKrw는 크론·이상감지가 그대로 쓰는 하위호환 필드.
 */
const UA = { "user-agent": "Mozilla/5.0 (yen-calc rate checker)" };
const EXTRA_CURRENCIES = ["EUR", "CNY"]; // data/countries.js 출발국 통화 중 JPY·USD 외

export async function fromManana() {
  const r = await fetch("https://api.manana.kr/exchange/rate/KRW/JPY,USD,EUR,CNY.json", {
    signal: AbortSignal.timeout(6000), headers: UA,
  });
  if (!r.ok) throw new Error(`manana ${r.status}`);
  const arr = await r.json();
  const pick = (c) => arr.find((x) => x.name === `${c}KRW=X`)?.rate;
  const jpy = pick("JPY");
  const usd = pick("USD");
  if (!jpy || !usd) throw new Error("manana 형식 오류");
  const krwPer = { JPY: jpy, USD: usd };
  for (const c of EXTRA_CURRENCIES) {
    const v = pick(c);
    if (v) krwPer[c] = v;
  }
  return { jpyKrw: jpy, usdKrw: usd, krwPer, source: "실시간 시세 (manana.kr)" };
}

export async function fromYahoo() {
  const get = async (sym) => {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=1h`,
      { signal: AbortSignal.timeout(6000), headers: UA }
    );
    if (!r.ok) throw new Error(`yahoo ${r.status}`);
    const d = await r.json();
    const v = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (!v) throw new Error("yahoo 형식 오류");
    return v;
  };
  // 네 통화를 동시에 요청 — JPY·USD는 필수(실패 시 소스 전체 실패), EUR·CNY는 부가 정보
  const extrasPromise = Promise.allSettled(EXTRA_CURRENCIES.map((c) => get(`${c}KRW=X`)));
  const [jpy, usd] = await Promise.all([get("JPYKRW=X"), get("KRW=X")]);
  const krwPer = { JPY: jpy, USD: usd };
  (await extrasPromise).forEach((e, i) => {
    if (e.status === "fulfilled") krwPer[EXTRA_CURRENCIES[i]] = e.value;
  });
  return { jpyKrw: jpy, usdKrw: usd, krwPer, source: "실시간 시세 (Yahoo Finance)" };
}

export async function fromErApi() {
  const r = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`er-api ${r.status}`);
  const d = await r.json();
  if (d.result !== "success" || !d.rates?.KRW || !d.rates?.JPY) throw new Error("er-api 형식 오류");
  const krwPer = { JPY: d.rates.KRW / d.rates.JPY, USD: d.rates.KRW };
  for (const c of EXTRA_CURRENCIES) {
    if (d.rates[c]) krwPer[c] = d.rates.KRW / d.rates[c];
  }
  return { jpyKrw: krwPer.JPY, usdKrw: krwPer.USD, krwPer, source: "open.er-api.com" };
}

export async function fromFrankfurter() {
  const r = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW,JPY,EUR,CNY", { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`frankfurter ${r.status}`);
  const d = await r.json();
  if (!d.rates?.KRW || !d.rates?.JPY) throw new Error("frankfurter 형식 오류");
  const krwPer = { JPY: d.rates.KRW / d.rates.JPY, USD: d.rates.KRW };
  for (const c of EXTRA_CURRENCIES) {
    if (d.rates[c]) krwPer[c] = d.rates.KRW / d.rates[c];
  }
  return { jpyKrw: krwPer.JPY, usdKrw: krwPer.USD, krwPer, source: "frankfurter.dev (ECB)" };
}

/** 성공한 소스만 반환 (1순위: 실시간 시세) */
export async function fetchAllSources() {
  const results = await Promise.allSettled([fromManana(), fromErApi(), fromFrankfurter()]);
  return results.filter((r) => r.status === "fulfilled").map((r) => r.value);
}

export function median(nums) {
  if (!nums.length) return NaN;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
