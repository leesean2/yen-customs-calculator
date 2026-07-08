import { useCallback, useEffect, useState } from "react";

/**
 * 실시간 환율 훅
 * - 1순위: /api/live-rate — 실시간 시세(manana.kr/Yahoo), 수 분 단위 갱신
 * - 폴백: open.er-api.com → api.frankfurter.dev (키 불필요, 일 1회 갱신)
 * - localStorage에 10분 캐시 → 재방문 시 즉시 표시 후 백그라운드 갱신
 *
 * 반환 rates: { jpyKrw: 1엔당 원, usdKrw: 1달러당 원 }
 */
const CACHE_KEY = "yen-calc:rates:v1";
const CACHE_TTL = 10 * 60 * 1000; // 10분 (장중 소스에 맞춰 단축)

async function fetchFromLiveApi(signal) {
  const res = await fetch("/api/live-rate", { signal });
  // API가 없는 환경(vite dev)에서는 HTML이 돌아온다
  if (!res.ok || !res.headers.get("content-type")?.includes("json")) {
    throw new Error("live-rate 사용 불가");
  }
  const data = await res.json();
  if (!data.jpyKrw || !data.usdKrw) throw new Error("live-rate: 응답 형식 오류");
  return {
    usdKrw: data.usdKrw,
    jpyKrw: data.jpyKrw,
    source: data.source,
    apiUpdatedAt: data.at ?? null,
  };
}

async function fetchFromErApi(signal) {
  const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal });
  if (!res.ok) throw new Error(`er-api HTTP ${res.status}`);
  const data = await res.json();
  if (data.result !== "success" || !data.rates?.KRW || !data.rates?.JPY) {
    throw new Error("er-api: 응답 형식 오류");
  }
  return {
    usdKrw: data.rates.KRW,
    jpyKrw: data.rates.KRW / data.rates.JPY,
    source: "open.er-api.com",
    apiUpdatedAt: data.time_last_update_utc ?? null,
  };
}

async function fetchFromFrankfurter(signal) {
  const res = await fetch(
    "https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW,JPY",
    { signal }
  );
  if (!res.ok) throw new Error(`frankfurter HTTP ${res.status}`);
  const data = await res.json();
  if (!data.rates?.KRW || !data.rates?.JPY) {
    throw new Error("frankfurter: 응답 형식 오류");
  }
  return {
    usdKrw: data.rates.KRW,
    jpyKrw: data.rates.KRW / data.rates.JPY,
    source: "frankfurter.dev (ECB)",
    apiUpdatedAt: data.date ?? null,
  };
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.rates?.jpyKrw || !parsed?.rates?.usdKrw) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(rates) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ rates, savedAt: Date.now() })
    );
  } catch {
    /* storage 불가 환경(사파리 프라이빗 등)은 무시 */
  }
}

export default function useExchangeRates() {
  const [rates, setRates] = useState(null); // { jpyKrw, usdKrw, source, apiUpdatedAt }
  const [status, setStatus] = useState("loading"); // loading | live | cached | error
  const [fetchedAt, setFetchedAt] = useState(null);

  const load = useCallback(async (signal) => {
    setStatus((s) => (s === "live" ? s : "loading"));
    try {
      let result = null;
      for (const fetcher of [fetchFromLiveApi, fetchFromErApi, fetchFromFrankfurter]) {
        try {
          result = await fetcher(signal);
          break;
        } catch (err) {
          if (signal?.aborted) throw err;
        }
      }
      if (!result) throw new Error("모든 환율 소스 실패");
      setRates(result);
      setFetchedAt(Date.now());
      setStatus("live");
      writeCache(result);
    } catch (err) {
      if (signal?.aborted) return;
      const cached = readCache();
      if (cached) {
        setRates(cached.rates);
        setFetchedAt(cached.savedAt);
        setStatus("cached");
      } else {
        setStatus("error");
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const cached = readCache();
    if (cached) {
      // 캐시 즉시 반영 후, 오래됐으면 백그라운드 갱신
      setRates(cached.rates);
      setFetchedAt(cached.savedAt);
      setStatus("cached");
      if (Date.now() - cached.savedAt > CACHE_TTL) load(controller.signal);
      else setStatus("live");
    } else {
      load(controller.signal);
    }
    return () => controller.abort();
  }, [load]);

  const refresh = useCallback(() => {
    const controller = new AbortController();
    load(controller.signal);
  }, [load]);

  return { rates, status, fetchedAt, refresh };
}
