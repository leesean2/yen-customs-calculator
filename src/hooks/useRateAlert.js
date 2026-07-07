import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 목표 환율 알림 훅
 * - 설정(목표가·방향·활성화)은 localStorage에 저장되어 재방문 시 유지
 * - 활성화 중에는 10분마다, 탭 복귀 시마다 환율을 재조회
 * - 조건 도달 시 triggered=true (앱 상단 배너) + 브라우저 알림 1회 발송
 *
 * 환율 소스가 하루 1회 갱신되므로 분 단위 실시간 시세 알림은 아니다.
 */
const CFG_KEY = "yen-calc:rate-alert:v1";
const POLL_MS = 10 * 60 * 1000;
const DEFAULT_CFG = { enabled: false, target: "", dir: "below" };

function readCfg() {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    return raw ? { ...DEFAULT_CFG, ...JSON.parse(raw) } : DEFAULT_CFG;
  } catch {
    return DEFAULT_CFG;
  }
}

export default function useRateAlert(liveRate, refresh) {
  const [config, setConfig] = useState(readCfg);
  const notifiedRef = useRef(false);

  const update = useCallback((patch) => {
    setConfig((c) => {
      const next = { ...c, ...patch };
      try { localStorage.setItem(CFG_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const target = parseFloat(config.target);
  const triggered =
    config.enabled && liveRate > 0 && target > 0 &&
    (config.dir === "below" ? liveRate <= target : liveRate >= target);

  // 활성화 중 주기 갱신 + 탭 복귀 시 즉시 갱신
  useEffect(() => {
    if (!config.enabled) return;
    const id = setInterval(refresh, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [config.enabled, refresh]);

  // 도달 순간(엣지)에만 브라우저 알림 1회 — 조건이 풀리면 재무장
  useEffect(() => {
    if (!triggered) {
      notifiedRef.current = false;
      return;
    }
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification("엔화 목표 환율 도달 🔔", {
          body: `현재 1엔 = ${liveRate.toFixed(2)}원 — 목표 ${target}원 ${config.dir === "below" ? "이하" : "이상"}`,
        });
      } catch { /* 일부 브라우저는 페이지 알림 미지원 */ }
    }
  }, [triggered, liveRate, target, config.dir]);

  return { config, update, triggered, target };
}
