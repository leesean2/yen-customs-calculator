import { useCallback, useEffect, useState } from "react";
import { fetchKrwPerUnit } from "../lib/fx.js";

/**
 * JPY·USD 외 출발국 통화(EUR·CNY 등)의 '원/1단위' 환율을 frankfurter에서 가져온다.
 * JPY·USD는 App의 실시간 환율(jr·ur)을 쓰므로 currency=null로 호출해 조회를 건너뛴다.
 * 반환: { rate, status: idle|loading|live|error, date, retry }
 */
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
      .then(({ krwPerUnit, date }) => alive && setState({ rate: krwPerUnit, status: "live", date }))
      .catch(() => alive && setState({ rate: 0, status: "error", date: null }));
    return () => { alive = false; };
  }, [currency, attempt]);

  return { ...state, retry };
}
