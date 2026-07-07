import { useCallback, useEffect, useState } from "react";

/**
 * 실시간 환율 훅
 * - 기본 소스: open.er-api.com (키 불필요, CORS 허용, 일 1회 갱신)
 * - 폴백 소스: api.frankfurter.dev (ECB 고시, 키 불필요)
 * - localStorage에 1시간 캐시 → 재방문 시 즉시 표시 후 백그라운드 갱신
 *
 * 반환 rates: { jpyKrw: 1엔당 원, usdKrw: 1달러당 원 }
 */
const CACHE_KEY = "yen-calc:rates:v1";
const CACHE_TTL = 60 * 60 * 1000; // 1시간

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
      let result;
      try {
        result = await fetchFromErApi(signal);
      } catch (primaryErr) {
        if (signal?.aborted) throw primaryErr;
        result = await fetchFromFrankfurter(signal);
      }
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
