import { useCallback, useEffect, useRef, useState } from "react";
import { ORIGIN_COUNTRIES } from "../data/countries.js";

/**
 * 목표 환율 알림 훅 (다통화 — JPY·USD·EUR·CNY)
 * - 설정(통화·목표가·방향·활성화)은 localStorage에 저장되어 재방문 시 유지
 * - 활성화 중에는 10분마다, 탭 복귀 시마다 환율을 재조회
 * - 조건 도달 시 triggered=true (앱 상단 배너) + 브라우저 알림 1회 발송
 *
 * krwPer: useExchangeRates의 통화→원/1단위 실시간 맵 (수동 입력값은 판정에 안 씀)
 * 목표가(target)는 표기 단위 기준 원화 — 엔은 국내 관행상 100엔, 그 외 1단위
 * (unit/unitLabel은 data/countries.js의 rateUnit/rateUnitLabel을 따른다).
 */
const CFG_KEY = "yen-calc:rate-alert:v2";
const LEGACY_CFG_KEY = "yen-calc:rate-alert:v1"; // target이 1엔 기준이던 시절
const POLL_MS = 10 * 60 * 1000;
const DEFAULT_CFG = { enabled: false, target: "", dir: "below", cur: "JPY" };

function readCfg() {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) return { ...DEFAULT_CFG, ...JSON.parse(raw) };
    const legacy = localStorage.getItem(LEGACY_CFG_KEY);
    if (legacy) {
      const cfg = { ...DEFAULT_CFG, ...JSON.parse(legacy) };
      const t = parseFloat(cfg.target);
      if (t > 0) cfg.target = String(+(t * 100).toFixed(2)); // 1엔 → 100엔 기준
      localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
      localStorage.removeItem(LEGACY_CFG_KEY);
      return cfg;
    }
    return DEFAULT_CFG;
  } catch {
    return DEFAULT_CFG;
  }
}

export default function useRateAlert(krwPer, refresh) {
  const [config, setConfig] = useState(readCfg);
  const notifiedRef = useRef(false);

  const update = useCallback((patch) => {
    setConfig((c) => {
      const next = { ...c, ...patch };
      try { localStorage.setItem(CFG_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // 저장값이 손상되어 미지원 통화면 엔으로 정규화 — 단위 표기와 조회 키가 어긋나지 않게
  const cur = ORIGIN_COUNTRIES.some((c) => c.currency === config.cur) ? config.cur : "JPY";
  const { rateUnit: unit, rateUnitLabel: unitLabel } =
    ORIGIN_COUNTRIES.find((c) => c.currency === cur);
  const unitText = `${unit === 1 ? "1" : unit}${unitLabel}`; // "100엔" · "1달러" 등

  const live = krwPer?.[cur] ?? 0; // 1단위당 원
  const liveUnit = live * unit;    // 표기 단위 기준 원
  const liveText = liveUnit.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const target = parseFloat(config.target); // 표기 단위 기준 원화
  const triggered =
    config.enabled && live > 0 && target > 0 &&
    (config.dir === "below" ? liveUnit <= target : liveUnit >= target);

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
        new Notification("목표 환율 도달 🔔", {
          body: `현재 ${unitText} = ${liveText}원 — 목표 ${target}원 ${config.dir === "below" ? "이하" : "이상"}`,
        });
      } catch { /* 일부 브라우저는 페이지 알림 미지원 */ }
    }
  }, [triggered, liveText, unitText, target, config.dir]);

  return { config, update, triggered, target, live, liveUnit, liveText, unit, unitLabel, unitText };
}
