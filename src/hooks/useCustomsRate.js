import { useEffect, useState } from "react";

/**
 * 관세청 과세환율 훅 — /api/customs-rate 프록시에서 주간 고시 환율을 받아온다.
 * 실제 세액 산정 기준이라 시장 환율 계산과의 괴리를 보여주는 용도.
 * 서버에 UNIPASS_API_KEY가 없거나(미구성) API가 없는 환경(vite dev)이면
 * null을 반환하고, 소비자는 관련 UI를 숨긴다. 주간 고시라 재조회는 불필요.
 * 반환: null | { rates: { USD, JPY(1엔당), EUR, CNY }, appliedFrom, source }
 */
export default function useCustomsRate() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/customs-rate")
      .then((r) =>
        r.ok && r.headers.get("content-type")?.includes("json") ? r.json() : null
      )
      .then((d) => {
        if (alive && d?.configured && d.rates?.USD) setData(d);
      })
      .catch(() => { /* 미구성·오류는 기능 숨김으로 충분 */ });
    return () => { alive = false; };
  }, []);

  return data;
}
