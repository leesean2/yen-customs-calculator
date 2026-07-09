import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "../lib/monitor.js";

/**
 * 실시간 환율 훅
 * - 1순위: /api/live-rate — 실시간 시세(manana.kr/Yahoo), 수 분 단위 갱신
 * - 폴백: open.er-api.com → api.frankfurter.dev (키 불필요, 일 1회 갱신)
 * - localStorage에 10분 캐시 → 재방문 시 즉시 표시 후 백그라운드 갱신
 *
 * 반환 rates: { jpyKrw, usdKrw, krwPer, source } — krwPer는 통화→원 맵.
 * 통화 일반화: 출발국이 늘어도(미국/유럽 등) krwPer[currency]로 조회하면 되도록,
 * 각 소스가 통화별 원화 환율을 맵으로 반환한다. 지금 UI는 JPY·USD만 읽는다.
 * 폴백 체인이 몇 단계까지 떨어지는지는 monitor로 진단 전송(개인정보 없음, 소스명만).
 */
const CACHE_KEY = "yen-calc:rates:v1";
const CACHE_TTL = 10 * 60 * 1000; // 10분 (장중 소스에 맞춰 단축)

/** USD 기준 rates({KRW, JPY, EUR, ...})를 통화→원 맵으로 변환.
 *  USD는 KRW 자체, 나머지는 KRW/해당통화. 확장 시 통화 코드만 추가하면 된다. */
function krwPerFromUsdBase(rates) {
  const krw = rates.KRW;
  const per = { USD: krw };
  for (const cur of ["JPY", "EUR", "CNY"]) {
    if (rates[cur]) per[cur] = krw / rates[cur];
  }
  return per;
}

async function fetchFromLiveApi(signal) {
  const res = await fetch("/api/live-rate", { signal });
  // API가 없는 환경(vite dev)에서는 HTML이 돌아온다
  if (!res.ok || !res.headers.get("content-type")?.includes("json")) {
    throw new Error("live-rate 사용 불가");
  }
  const data = await res.json();
  if (!data.jpyKrw || !data.usdKrw) throw new Error("live-rate: 응답 형식 오류");
  // 실시간 소스는 아직 JPY·USD만 제공 — 다른 통화 확장 시 api/_lib/rates.js도 넓힐 것
  return {
    krwPer: { USD: data.usdKrw, JPY: data.jpyKrw },
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
    krwPer: krwPerFromUsdBase(data.rates),
    source: "open.er-api.com",
    apiUpdatedAt: data.time_last_update_utc ?? null,
  };
}

async function fetchFromFrankfurter(signal) {
  const res = await fetch(
    "https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW,JPY,EUR,CNY",
    { signal }
  );
  if (!res.ok) throw new Error(`frankfurter HTTP ${res.status}`);
  const data = await res.json();
  if (!data.rates?.KRW || !data.rates?.JPY) {
    throw new Error("frankfurter: 응답 형식 오류");
  }
  return {
    krwPer: krwPerFromUsdBase(data.rates),
    source: "frankfurter.dev (ECB)",
    apiUpdatedAt: data.date ?? null,
  };
}

// 조회 순서 — 진단 로그에 어느 소스가 실패했는지 이름으로 남긴다
const SOURCES = [
  { name: "live-rate", fn: fetchFromLiveApi },
  { name: "er-api", fn: fetchFromErApi },
  { name: "frankfurter", fn: fetchFromFrankfurter },
];

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
  const [rates, setRates] = useState(null); // { jpyKrw, usdKrw, krwPer, source, apiUpdatedAt }
  const [status, setStatus] = useState("loading"); // loading | live | cached | error
  const [fetchedAt, setFetchedAt] = useState(null);
  const ctrlRef = useRef(null); // 진행 중 조회 — 새 조회가 시작되면 중단

  const load = useCallback(async () => {
    // 이전 in-flight 요청을 중단 — 늦게 도착한 옛 응답이 최신 값을 덮어쓰는 레이스 방지
    ctrlRef.current?.abort();
    const controller = new AbortController();
    ctrlRef.current = controller;
    const signal = controller.signal;

    setStatus((s) => (s === "live" ? s : "loading"));
    try {
      let result = null;
      let depth = 0;
      const failed = [];
      for (let i = 0; i < SOURCES.length; i++) {
        try {
          result = await SOURCES[i].fn(signal);
          depth = i;
          break;
        } catch (err) {
          if (signal.aborted) throw err;
          failed.push(SOURCES[i].name);
        }
      }
      if (!result) {
        // 전 소스 실패 — 어느 소스가 죽었는지만 진단(가격·개인 데이터 없음)
        track("rate_all_failed", { failed });
        throw new Error("모든 환율 소스 실패");
      }
      if (signal.aborted) return;
      // 1순위(실시간) 실패 후 폴백으로 값을 얻은 경우에만 폴백 깊이를 진단
      if (depth > 0) track("rate_fallback", { used: result.source, depth, failed });

      const rates = {
        jpyKrw: result.krwPer.JPY,
        usdKrw: result.krwPer.USD,
        krwPer: result.krwPer,
        source: result.source,
        apiUpdatedAt: result.apiUpdatedAt,
      };
      setRates(rates);
      setFetchedAt(Date.now());
      setStatus("live");
      writeCache(rates);
    } catch (err) {
      if (signal.aborted) return;
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
    const cached = readCache();
    if (cached) {
      // 캐시 즉시 반영 후, 오래됐으면 백그라운드 갱신
      setRates(cached.rates);
      setFetchedAt(cached.savedAt);
      setStatus("cached");
      if (Date.now() - cached.savedAt > CACHE_TTL) load();
      else setStatus("live");
    } else {
      load();
    }
    return () => ctrlRef.current?.abort();
  }, [load]);

  return { rates, status, fetchedAt, refresh: load };
}
