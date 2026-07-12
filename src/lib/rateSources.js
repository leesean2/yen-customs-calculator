/**
 * 환율 이상 감지용 다중 소스 조회 (다통화 — JPY·USD·EUR·CNY)
 * 서로 독립적인 무료 소스 3곳에서 통화→KRW를 받아 교차 검증한다.
 * 소스별 스냅샷 시점이 달라 0.5~1% 안팎의 차이는 정상 범위.
 */
import { timeoutSignal } from "./net.js";

async function fetchErApi(cur, signal) {
  const res = await fetch(`https://open.er-api.com/v6/latest/${cur}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const v = data?.rates?.KRW;
  if (data.result !== "success" || !v) throw new Error("응답 형식 오류");
  return v;
}

async function fetchFrankfurter(cur, signal) {
  const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${cur}&symbols=KRW`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const v = data?.rates?.KRW;
  if (!v) throw new Error("응답 형식 오류");
  return v;
}

async function fetchCurrencyApi(cur, signal) {
  const lc = cur.toLowerCase();
  const res = await fetch(
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${lc}.json`,
    { signal }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const v = data?.[lc]?.krw;
  if (!v) throw new Error("응답 형식 오류");
  return v;
}

const SOURCES = [
  { name: "open.er-api.com", fn: fetchErApi },
  { name: "frankfurter.dev (ECB)", fn: fetchFrankfurter },
  { name: "currency-api (jsDelivr)", fn: fetchCurrencyApi },
];

/** 모든 소스를 병렬 조회 (krw는 1단위당 원). 실패한 소스도 { ok:false }로 함께 반환 */
export async function fetchKrwAll(currency = "JPY", signal) {
  const sig = signal ?? timeoutSignal(10_000); // 한 소스가 먹통이어도 UI가 멈추지 않게
  const results = await Promise.allSettled(SOURCES.map((s) => s.fn(currency, sig)));
  return SOURCES.map((s, i) =>
    results[i].status === "fulfilled"
      ? { name: s.name, ok: true, krw: results[i].value }
      : { name: s.name, ok: false, error: results[i].reason?.message ?? "실패" }
  );
}

export function median(nums) {
  if (!nums.length) return NaN;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** 중앙값 대비 편차(%) — 양수면 중앙값보다 높음 */
export function deviationPct(value, med) {
  return med ? ((value - med) / med) * 100 : NaN;
}
