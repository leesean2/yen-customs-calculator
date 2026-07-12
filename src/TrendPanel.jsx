import { useState } from "react";
import { T } from "./ui.jsx";
import RateTrendChart from "./RateTrend.jsx";

/* 환율 추이 차트의 전역 접이식 래퍼 — 환율 설정 바로 아래(모든 탭 공통)에서
   실시간 환율과 추이를 같이 본다. 통화·목표선은 알림 설정(rateAlert)을 그대로
   따라, 알림 탭에서 통화를 바꾸면 이 차트도 함께 바뀐다.
   열림 상태는 localStorage에 저장 — 한 번 펼치면 재방문에도 유지된다. */
const OPEN_KEY = "yen-calc:trend-open:v1";

export default function TrendPanel({ rateAlert }) {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(OPEN_KEY) === "1"; } catch { return false; }
  });
  const toggle = () =>
    setOpen((o) => {
      const next = !o;
      try { localStorage.setItem(OPEN_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });

  const { cur, target, liveUnit, unitText } = rateAlert;

  return (
    <div style={{ margin: "-6px 0 14px" }}>
      <button
        onClick={toggle}
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          border: "none", background: "transparent", padding: "2px 2px",
          fontSize: 12, fontWeight: 700, color: T.indigo, cursor: "pointer",
        }}
      >
        <span
          aria-hidden="true"
          style={{ display: "inline-block", transition: "transform .15s", transform: open ? "rotate(90deg)" : "none" }}
        >
          ▸
        </span>
        📈 환율 추이 차트 {open ? "접기" : "보기"}
        <span style={{ fontWeight: 600, color: T.muted, fontSize: 11 }}>
          (원/{unitText} · 실시간 병기{open ? "" : " · 어느 탭에서든"})
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 8 }}>
          <RateTrendChart currency={cur} target={target > 0 ? target : 0} live={liveUnit > 0 ? liveUnit : 0} />
        </div>
      )}
    </div>
  );
}
