import { useEffect, useMemo, useState } from "react";
import { T, NumField } from "./ui.jsx";
import { fetchJpyKrwAll, median, deviationPct } from "./lib/rateSources.js";

/* ──────────────────────────────────────────────
   환율 알림 · 이상 감지 탭
   1) 목표 환율 알림 — 설정은 useRateAlert(App)에서 관리, 여기는 설정 UI
   2) 이상 감지 — 다중 소스 교차 검증 + 은행 고시환율/직접 입력 비교
      (토스뱅크 반값 엔화 오류 사례처럼 특정 고시가 시장과 크게 벌어진 경우 경고)
   ────────────────────────────────────────────── */

const rate4 = (n) => (isNaN(n) ? "—" : n.toFixed(4) + "원");

function devColor(absPct) {
  return absPct < 1 ? T.green : absPct < 3 ? "#C79A2A" : T.red;
}

function SourceRow({ name, value, dev, error, badge }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "6px 0", borderTop: `1px solid ${T.line}` }}>
      <span style={{ flex: 1, fontSize: 12.5, color: T.muted, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name}{badge && <em style={{ fontStyle: "normal", fontSize: 10.5, color: T.indigo, marginLeft: 6 }}>{badge}</em>}
      </span>
      {error ? (
        <span style={{ fontSize: 12, color: T.red }}>{error}</span>
      ) : (
        <>
          <span style={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{rate4(value)}</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: devColor(Math.abs(dev)), width: 58, textAlign: "right" }}>
            {isNaN(dev) ? "" : (dev > 0 ? "+" : "") + dev.toFixed(2) + "%"}
          </span>
        </>
      )}
    </div>
  );
}

const sectionStyle = {
  background: T.card, border: `1.5px solid ${T.line}`,
  borderRadius: 14, padding: "16px 16px 6px", marginBottom: 14,
};
const titleStyle = { fontSize: 13.5, fontWeight: 800, color: T.ink, marginBottom: 4 };
const descStyle = { fontSize: 12, color: T.muted, lineHeight: 1.6, margin: "0 0 12px" };

export default function AlertTab({ liveRate, rateAlert }) {
  const { config, update, triggered } = rateAlert;

  // ── 브라우저 알림 권한 ──
  const [notifPerm, setNotifPerm] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const askPermission = async () => {
    if (typeof Notification === "undefined") return;
    setNotifPerm(await Notification.requestPermission());
  };

  // ── 이상 감지 ──
  const [check, setCheck] = useState({ phase: "idle", rows: [], bank: null, at: null });
  const [myBankRate, setMyBankRate] = useState("");

  const runCheck = async () => {
    setCheck((c) => ({ ...c, phase: "loading" }));
    const [rows, bank] = await Promise.all([
      fetchJpyKrwAll(),
      fetch("/api/bank-rate").then((r) => r.json()).catch(() => null),
    ]);
    setCheck({ phase: "done", rows, bank, at: Date.now() });
  };
  useEffect(() => { runCheck(); }, []);

  const analysis = useMemo(() => {
    const ok = check.rows.filter((r) => r.ok);
    const med = median(ok.map((r) => r.jpyKrw));
    const rows = check.rows.map((r) =>
      r.ok ? { ...r, dev: deviationPct(r.jpyKrw, med) } : r
    );
    const bankDev = check.bank?.jpyKrw ? deviationPct(check.bank.jpyKrw, med) : NaN;
    const devs = [
      ...rows.filter((r) => r.ok).map((r) => Math.abs(r.dev)),
      ...(isNaN(bankDev) ? [] : [Math.abs(bankDev)]),
    ];
    const maxDev = devs.length ? Math.max(...devs) : NaN;
    const level =
      ok.length < 2 ? "insufficient" : maxDev < 1 ? "ok" : maxDev < 3 ? "warn" : "danger";
    return { rows, med, bankDev, maxDev, level, okCount: ok.length };
  }, [check]);

  const my = parseFloat(myBankRate);
  const myDev = my > 0 ? deviationPct(my, analysis.med) : NaN;

  return (
    <>
      {/* ── 1. 목표 환율 알림 ── */}
      <section style={sectionStyle}>
        <div style={titleStyle}>🔔 목표 환율 알림</div>
        <p style={descStyle}>
          현재 1엔 = <b style={{ color: T.ink }}>{liveRate > 0 ? liveRate.toFixed(2) + "원" : "—"}</b>.
          목표에 도달하면 앱 상단 배너와 브라우저 알림으로 알려드립니다.
          (탭이 열려 있는 동안 10분마다 확인 · 환율 소스는 하루 1회 갱신)
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <NumField label="목표 환율" suffix="원 / 1엔" value={config.target} onChange={(v) => update({ target: v })} />
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.indigo, marginBottom: 5 }}>조건</span>
            <select value={config.dir} onChange={(e) => update({ dir: e.target.value })} style={{
              width: "100%", padding: "12px 12px", fontSize: 14.5, fontWeight: 600, color: T.ink,
              border: `1.5px solid ${T.line}`, borderRadius: 10, background: "#FCFDFB", outline: "none",
            }}>
              <option value="below">이하로 내려가면 (엔저 · 살 때 유리)</option>
              <option value="above">이상으로 올라가면</option>
            </select>
          </label>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={config.enabled} onChange={(e) => update({ enabled: e.target.checked })}
            style={{ width: 18, height: 18, accentColor: T.indigo }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>알림 활성화</span>
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {notifPerm === "default" && (
            <button onClick={askPermission} style={{
              border: `1px solid ${T.indigo}`, background: "transparent", color: T.indigo,
              borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>
              브라우저 알림 허용하기
            </button>
          )}
          <span style={{ fontSize: 11.5, color: T.muted }}>
            {notifPerm === "granted" && "✓ 브라우저 알림 허용됨"}
            {notifPerm === "denied" && "브라우저 알림이 차단되어 있어 화면 배너로만 알립니다."}
            {notifPerm === "default" && "허용하면 다른 탭을 보고 있어도 알림을 받습니다."}
            {notifPerm === "unsupported" && "이 브라우저는 알림을 지원하지 않아 화면 배너로만 알립니다."}
          </span>
        </div>

        {triggered && (
          <div style={{ background: T.greenSoft, border: `1.5px solid ${T.green}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13.5, fontWeight: 700, color: T.green }}>
            🎯 목표 도달! 현재 {liveRate.toFixed(2)}원 — 목표 {config.target}원 {config.dir === "below" ? "이하" : "이상"}
          </div>
        )}
      </section>

      {/* ── 2. 환율 이상 감지 ── */}
      <section style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ ...titleStyle, flex: 1 }}>⚠️ 환율 이상 감지</div>
          <button onClick={runCheck} disabled={check.phase === "loading"} style={{
            border: `1px solid ${T.indigo}`, background: "transparent", color: T.indigo,
            borderRadius: 7, padding: "4px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer",
          }}>
            {check.phase === "loading" ? "검사 중…" : "다시 검사"}
          </button>
        </div>
        <p style={descStyle}>
          독립적인 환율 소스 여러 곳을 교차 검증합니다. 특정 고시환율이 시장에서 크게 벗어나면
          — 2024년 토스뱅크 &lsquo;반값 엔화&rsquo; 오류처럼 — 고시 오류이거나 일시적 차익 기회일 수 있습니다.
        </p>

        {check.phase === "done" && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "6px 0" }}>
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: T.ink }}>
                  시장 기준 (중앙값 · 소스 {analysis.okCount}곳)
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{rate4(analysis.med)}</span>
                <span style={{ width: 58 }} />
              </div>
              {analysis.rows.map((r) => (
                <SourceRow key={r.name} name={r.name} value={r.jpyKrw} dev={r.dev} error={r.ok ? null : "조회 실패"} />
              ))}
              {check.bank?.jpyKrw && (
                <SourceRow name={check.bank.source} badge={check.bank.date} value={check.bank.jpyKrw} dev={analysis.bankDev} />
              )}
              {check.bank && check.bank.configured === false && (
                <p style={{ fontSize: 11, color: T.muted, margin: "6px 0 0", lineHeight: 1.5 }}>
                  수출입은행 고시환율 비교는 Vercel 환경변수 <code>KOREAEXIM_API_KEY</code> 설정 시 자동 표시됩니다.
                </p>
              )}
              {check.bank?.error && (
                <p style={{ fontSize: 11, color: T.red, margin: "6px 0 0", lineHeight: 1.5 }}>
                  수출입은행 고시환율 조회 실패: {check.bank.error}
                </p>
              )}
            </div>

            <div style={{
              borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, fontWeight: 700, lineHeight: 1.6,
              background: analysis.level === "ok" ? T.greenSoft : analysis.level === "danger" ? T.redSoft : "#FBF4E3",
              color: analysis.level === "ok" ? T.green : analysis.level === "danger" ? T.red : "#8A6914",
            }}>
              {analysis.level === "insufficient" && "소스가 부족해 교차 검증할 수 없습니다. 잠시 후 다시 검사해 주세요."}
              {analysis.level === "ok" && `✓ 정상 — 소스 간 최대 편차 ${analysis.maxDev.toFixed(2)}% (1% 미만)`}
              {analysis.level === "warn" && `주의 — 소스 간 최대 편차 ${analysis.maxDev.toFixed(2)}%. 갱신 시점 차이일 수 있으나 결제 전 재확인을 권합니다.`}
              {analysis.level === "danger" && `🚨 비정상 — 최대 편차 ${analysis.maxDev.toFixed(2)}%. 특정 소스의 고시 오류 가능성이 있습니다. 실거래 전 반드시 복수 소스로 확인하세요.`}
            </div>
          </>
        )}
        {check.phase === "loading" && (
          <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>환율 소스를 조회하는 중…</p>
        )}

        <div style={{ borderTop: `1px dashed ${T.line}`, paddingTop: 12 }}>
          <NumField
            label="내 은행/앱에 표시된 환율 (선택)" suffix="원 / 1엔"
            value={myBankRate} onChange={setMyBankRate}
            hint="토스·하나·신한 등 앱에 보이는 엔화 환율을 입력하면 시장 기준과 비교합니다"
          />
          {my > 0 && !isNaN(myDev) && (
            <div style={{
              borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, lineHeight: 1.7,
              background: Math.abs(myDev) < 3 ? T.greenSoft : T.redSoft,
              color: Math.abs(myDev) < 3 ? T.green : T.red, fontWeight: 600,
            }}>
              {Math.abs(myDev) < 3 ? (
                <>시장 기준 대비 <b>{myDev > 0 ? "+" : ""}{myDev.toFixed(2)}%</b> — 정상 범위입니다.
                  (현찰 살 때는 매매기준율보다 최대 ±1.75% 스프레드가 붙는 것이 일반적)</>
              ) : (
                <>🚨 시장 기준 대비 <b>{myDev > 0 ? "+" : ""}{myDev.toFixed(2)}%</b> —
                  은행 고시 오류이거나 일시적 차익 기회일 수 있습니다.
                  다른 은행·환전소 환율과 교차 확인 후 이용하세요. 오류 고시로 체결된 거래는 사후 취소될 수 있습니다.</>
              )}
            </div>
          )}
        </div>
      </section>

      <p style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.7, marginTop: 14 }}>
        · 알림은 이 페이지(탭)가 브라우저에 열려 있는 동안 동작합니다. 백그라운드 푸시는 지원하지 않습니다.<br />
        · 무료 환율 소스는 대부분 하루 1회 갱신되므로, 초 단위 시세 알림이 필요하면 증권사·은행 앱을 함께 이용하세요.
      </p>
    </>
  );
}
