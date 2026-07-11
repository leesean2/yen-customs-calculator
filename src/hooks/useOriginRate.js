import { useCallback, useEffect, useState } from "react";
import { fetchKrwPerUnit } from "../lib/fx.js";

/**
 * JPY·USD 외 출발국 통화(EUR·CNY 등)의 '원/1단위' 환율을 frankfurter에서 가져온다.
 * JPY·USD는 App의 실시간 환율(jr·ur)을 쓰므로 currency=null로 호출해 조회를 건너뛴다.
 * 조회 실패 시 마지막 성공값(localStorage)으로 폴백한다 — 오프라인·API 장애에서도
 * ECB 일간 환율은 며칠 묵어도 참고용 계산에는 0원보다 낫고, 고시일을 함께 표시한다.
 * 반환: { rate, status: idle|loading|live|cached|error, date, retry }
 */
const CACHE_KEY = "yen-calc:origin-rate:v1"; // { [currency]: { rate, date } }

function readCache(currency) {
  try {
    const entry = JSON.parse(localStorage.getItem(CACHE_KEY))?.[currency];
    return entry?.rate > 0 ? entry : null;
  } catch {
    return null;
  }
}

function writeCache(currency, entry) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY)) ?? {};
    all[currency] = entry;
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* storage 불가 환경(사파리 프라이빗 등)은 무시 */
  }
}

export default function useOriginRate(currency) {
  const [state, setState] = useState({ rate: 0, status: "idle", date: null });
  const [attempt, setAttempt] = useState(0); // retry()가 올려 같은 통화 재조회를 트리거
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!currency) {
      setState({ rate: 0, status: "idle", date: null });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, status: "loading" }));
    fetchKrwPerUnit(currency)
      .then(({ krwPerUnit, date }) => {
        if (!alive) return;
        writeCache(currency, { rate: krwPerUnit, date });
        setState({ rate: krwPerUnit, status: "live", date });
      })
      .catch(() => {
        if (!alive) return;
        const cached = readCache(currency);
        setState(
          cached
            ? { rate: cached.rate, status: "cached", date: cached.date }
            : { rate: 0, status: "error", date: null }
        );
      });
    return () => { alive = false; };
  }, [currency, attempt]);

  return { ...state, retry };
}
