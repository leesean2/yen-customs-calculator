import { useEffect, useRef, useState } from "react";
import { T, chipBtn, linkBtn, panel } from "./ui.jsx";
import { ORIGIN_COUNTRIES } from "./data/countries.js";
import { fetchKrwSeries } from "./lib/fx.js";
import { percentileRank, percentileVerdict, percentileText } from "./lib/percentile.js";

/* ──────────────────────────────────────────────
   환율 추이 차트 (알림 탭) — 목표 환율을 정할 때 "지금이 싼 편인지"를
   보여준다. ECB 일간 시계열(frankfurter, lib/fx.js)이라 영업일만 찍힌다.
   단일 시리즈 라인: 범례 없이 제목이 통화를 명명하고, 최고·최저만
   직접 라벨, 값·라벨은 잉크/뮤트 토큰, 선 색만 테마 인디고를 쓴다.
   ────────────────────────────────────────────── */

const W = 520, H = 150;                          // viewBox — 컨테이너 폭에 비례 축소
const PAD = { top: 26, right: 12, bottom: 22, left: 12 };
const RANGES = [{ days: 30, label: "30일" }, { days: 90, label: "90일" }];

const fmt = (n) => n.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
const md = (iso) => `${+iso.slice(5, 7)}/${+iso.slice(8)}`; // "2026-07-08" → "7/8"

/** 시계열 조회 상태 훅 — 차트(30/90일)와 1년 백분위가 같은 로딩 골격을 공유.
 *  points의 v는 표기 단위 원. attempt가 오르면 재조회('다시 시도' 공용). */
function useKrwSeries(currency, days, unit, attempt) {
  const [state, setState] = useState({ status: "loading", points: [] });
  useEffect(() => {
    let alive = true;
    setState({ status: "loading", points: [] });
    fetchKrwSeries(currency, days)
      .then((pts) => alive && setState({ status: "done", points: pts.map((p) => ({ date: p.date, v: p.rate * unit })) }))
      .catch(() => alive && setState({ status: "error", points: [] }));
    return () => { alive = false; };
  }, [currency, days, unit, attempt]);
  return state;
}

/** target: 목표 환율(표기 단위 기준 원) — 표시 범위 안이면 기준선으로 그린다
 *  live: 실시간 환율(표기 단위 기준 원, 없으면 0) — ECB 일간 시계열은 영업일
 *  하루 지연이라, 지금 시세를 기준선·요약·백분위에 함께 보여준다 */
export default function RateTrendChart({ currency, target = 0, live = 0 }) {
  const { rateUnit: unit, rateUnitLabel: unitLabel } =
    ORIGIN_COUNTRIES.find((c) => c.currency === currency) ?? ORIGIN_COUNTRIES[0];
  const unitText = `${unit === 1 ? "1" : unit}${unitLabel}`;

  const [days, setDays] = useState(30);
  const [hover, setHover] = useState(null); // 포인트 인덱스
  const [attempt, setAttempt] = useState(0);
  const boxRef = useRef(null);

  const state = useKrwSeries(currency, days, unit, attempt);
  // 최근 1년 백분위 — "지금이 싼 편인가"의 근거. 기간 토글과 무관하게 통화당 1회 조회
  const year = useKrwSeries(currency, 365, unit, attempt);
  useEffect(() => setHover(null), [currency, days, attempt]); // 재조회 중 옛 좌표 참조 방지

  // 비교 기준은 실시간 시세 — 없으면 1년 시계열 자신의 마지막 값(ECB 일간)으로 폴백
  const yearVals = year.points.map((p) => p.v);
  const yearPct = year.status === "done" && yearVals.length >= 2
    ? percentileRank(yearVals, live > 0 ? live : yearVals[yearVals.length - 1])
    : NaN;
  const verdict = percentileVerdict(yearPct);

  const pts = state.points;
  const done = state.status === "done" && pts.length >= 2;

  // 스케일 — y는 최소·최대에 5% 여백을 줘 선이 프레임에 붙지 않게
  // 실시간 시세는 항상 범위에 포함시켜 기준선이 잘리지 않게 한다 (일간 대비 편차는 작다)
  let path = "", area = "", coords = [], minI = 0, maxI = 0, targetY = null, liveY = null;
  if (done) {
    const vs = pts.map((p) => p.v);
    const lo = Math.min(...vs, ...(live > 0 ? [live] : []));
    const hi = Math.max(...vs, ...(live > 0 ? [live] : []));
    const padV = (hi - lo || hi * 0.01) * 0.05;
    const y = (v) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - (v - (lo - padV)) / ((hi + padV) - (lo - padV)));
    const x = (i) => PAD.left + (W - PAD.left - PAD.right) * (pts.length === 1 ? 0.5 : i / (pts.length - 1));
    coords = pts.map((p, i) => ({ cx: x(i), cy: y(p.v) }));
    path = coords.map((c, i) => `${i ? "L" : "M"}${c.cx.toFixed(1)},${c.cy.toFixed(1)}`).join(" ");
    area = `${path} L${coords[coords.length - 1].cx.toFixed(1)},${H - PAD.bottom} L${coords[0].cx.toFixed(1)},${H - PAD.bottom} Z`;
    // 최저·최고는 시계열(vs) 기준 — 실시간을 포함한 lo·hi와 다를 수 있다
    minI = vs.indexOf(Math.min(...vs));
    maxI = vs.indexOf(Math.max(...vs));
    // 목표선 — 표시 범위 안일 때만 (한참 벗어난 목표는 축을 짓누르지 않게 숨김)
    if (target > 0 && target >= lo - padV && target <= hi + padV) targetY = y(target);
    if (live > 0) liveY = y(live);
  }

  // 호버 — 포인터 x 위치에서 가장 가까운 포인트 (터치 포함)
  const onMove = (e) => {
    if (!done || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width * W;
    const i = Math.round((fx - PAD.left) / (W - PAD.left - PAD.right) * (pts.length - 1));
    setHover(Math.max(0, Math.min(pts.length - 1, i)));
  };

  const cur = done ? pts[pts.length - 1] : null;
  const hovered = hover != null && done ? pts[hover] : null;
  const label = (i, anchor) => (
    <text x={coords[i].cx} y={coords[i].cy - 8} textAnchor={anchor} style={{ fontSize: 11, fontWeight: 700, fill: "var(--c-muted)" }}>
      {fmt(pts[i].v)}
    </text>
  );

  return (
    <section style={{ ...panel(), padding: "16px 16px 12px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <div style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: T.ink }}>
          📈 환율 추이 <span style={{ fontWeight: 600, color: T.muted, fontSize: 12 }}>(원/{unitText} · ECB 일간)</span>
        </div>
        {RANGES.map((r) => (
          <button key={r.days} onClick={() => setDays(r.days)}
            style={days === r.days ? chipBtn({ solid: true }) : { ...chipBtn(), border: `1px solid ${T.line}`, color: T.muted }}>
            {r.label}
          </button>
        ))}
      </div>

      {state.status === "loading" && <p style={{ margin: "10px 0 4px", fontSize: 12, color: T.muted }}>추이 불러오는 중…</p>}
      {state.status === "done" && !done && (
        <p style={{ margin: "10px 0 4px", fontSize: 12, color: T.muted }}>표시할 추이 데이터가 부족합니다 (영업일 2일 이상 필요).</p>
      )}
      {state.status === "error" && (
        <p style={{ margin: "10px 0 4px", fontSize: 12, color: T.muted }}>
          추이를 불러오지 못했습니다.
          <button onClick={() => setAttempt((n) => n + 1)} style={{ ...linkBtn, fontSize: 12, marginLeft: 6 }}>다시 시도</button>
        </p>
      )}

      {done && (
        <>
          <div ref={boxRef} style={{ position: "relative" }}
            onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto" }}
              role="img" aria-label={`최근 ${days}일 원/${unitText} 환율 추이 — 최저 ${fmt(pts[minI].v)}원(${md(pts[minI].date)}), 최고 ${fmt(pts[maxI].v)}원(${md(pts[maxI].date)}), 현재(일간) ${fmt(cur.v)}원${liveY != null ? `, 실시간 ${fmt(live)}원` : ""}`}>
              {/* 은은한 그리드 2줄 — 축보다 데이터가 앞서게 */}
              {[1 / 3, 2 / 3].map((f) => (
                <line key={f} x1={PAD.left} x2={W - PAD.right}
                  y1={PAD.top + (H - PAD.top - PAD.bottom) * f} y2={PAD.top + (H - PAD.top - PAD.bottom) * f}
                  stroke="var(--c-line)" strokeWidth="1" />
              ))}
              {/* 목표 환율 기준선 — 시리즈보다 뒤에, 그리드보다 진하게 */}
              {targetY != null && (
                <>
                  <line x1={PAD.left} x2={W - PAD.right} y1={targetY} y2={targetY}
                    stroke="var(--c-muted)" strokeWidth="1.2" strokeDasharray="5 4" />
                  <text x={W - PAD.right} y={targetY - 5} textAnchor="end"
                    style={{ fontSize: 10.5, fontWeight: 700, fill: "var(--c-muted)" }}>
                    목표 {fmt(target)}
                  </text>
                </>
              )}
              {/* 실시간 시세 기준선 — 일간 시계열의 '지금' 위치 (라벨은 목표선과 반대쪽) */}
              {liveY != null && (
                <>
                  <line x1={PAD.left} x2={W - PAD.right} y1={liveY} y2={liveY}
                    stroke="var(--c-red)" strokeWidth="1.2" strokeDasharray="2 3" />
                  <text x={PAD.left} y={liveY - 5} textAnchor="start"
                    style={{ fontSize: 10.5, fontWeight: 700, fill: "var(--c-red)" }}>
                    실시간 {fmt(live)}
                  </text>
                </>
              )}
              <path d={area} fill="var(--c-indigo-soft)" />
              <path d={path} fill="none" stroke="var(--c-indigo)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {/* 선택적 직접 라벨: 최고·최저만 (둘 다 마커 + 값) */}
              {label(maxI, maxI < pts.length / 5 ? "start" : maxI > pts.length * 4 / 5 ? "end" : "middle")}
              <circle cx={coords[maxI].cx} cy={coords[maxI].cy} r="3" fill="var(--c-indigo)" stroke="var(--c-card)" strokeWidth="2" />
              <circle cx={coords[minI].cx} cy={coords[minI].cy} r="3" fill="var(--c-indigo)" stroke="var(--c-card)" strokeWidth="2" />
              <text x={coords[minI].cx} y={H - PAD.bottom + 14} textAnchor={minI < pts.length / 5 ? "start" : minI > pts.length * 4 / 5 ? "end" : "middle"}
                style={{ fontSize: 11, fontWeight: 700, fill: "var(--c-muted)" }}>
                최저 {fmt(pts[minI].v)}
              </text>
              {/* 호버 크로스헤어 */}
              {hovered && (
                <>
                  <line x1={coords[hover].cx} x2={coords[hover].cx} y1={PAD.top - 4} y2={H - PAD.bottom}
                    stroke="var(--c-muted)" strokeWidth="1" strokeDasharray="3 3" />
                  <circle cx={coords[hover].cx} cy={coords[hover].cy} r="4" fill="var(--c-indigo)" stroke="var(--c-card)" strokeWidth="2" />
                </>
              )}
            </svg>
            {hovered && (
              <div style={{
                position: "absolute", top: 0,
                left: `${(coords[hover].cx / W) * 100}%`,
                transform: `translateX(${hover > pts.length / 2 ? "-105%" : "5%"})`,
                background: T.card, border: `1px solid ${T.line}`, borderRadius: 8,
                padding: "4px 8px", fontSize: 11.5, fontWeight: 700, color: T.ink,
                pointerEvents: "none", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,.08)",
              }}>
                {md(hovered.date)} · {fmt(hovered.v)}원
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 11.5, color: T.muted, fontWeight: 600, marginTop: 6 }}>
            <span>최저 <b style={{ color: T.ink }}>{fmt(pts[minI].v)}원</b> ({md(pts[minI].date)})</span>
            <span>·</span>
            <span>최고 <b style={{ color: T.ink }}>{fmt(pts[maxI].v)}원</b> ({md(pts[maxI].date)})</span>
            <span>·</span>
            <span>현재(일간) <b style={{ color: T.ink }}>{fmt(cur.v)}원</b>{cur.v <= pts[minI].v * 1.01 ? " — 최근 저점 부근" : ""}</span>
            {liveY != null && (
              <>
                <span>·</span>
                <span>실시간 <b style={{ color: T.red }}>{fmt(live)}원</b></span>
              </>
            )}
          </div>
        </>
      )}
      {verdict && (
        <p style={{
          margin: "7px 0 2px", fontSize: 11.5, fontWeight: 700, lineHeight: 1.6,
          color: verdict.tone === "good" ? T.green : verdict.tone === "bad" ? T.red : T.muted,
        }}>
          지금 {unitText} 환율은 최근 1년 중 {percentileText(yearPct)} — {verdict.text}
          <span style={{ fontWeight: 500, color: T.muted }}> (ECB 일간 기준, 목표가를 정할 때 참고하세요)</span>
        </p>
      )}
    </section>
  );
}
