import { useCallback, useEffect, useMemo, useState } from "react";
import { T, NumField, chipBtn, panel } from "./ui.jsx";
import { fetchKrwAll, median, deviationPct } from "./lib/rateSources.js";
import { timeoutSignal } from "./lib/net.js";

/* ──────────────────────────────────────────────
   환율 이상 감지 (전역 — TrendPanel에서 추이 차트와 함께 표시)
   다중 소스 교차 검증 + 은행 고시환율/직접 입력 비교
   (토스뱅크 반값 엔화 오류 사례처럼 특정 고시가 시장과 크게 벌어진 경우 경고)
   통화는 알림 설정(rateAlert.cur)을 따른다 — 알림 탭에서 바꾸면 여기도 재조회.
   ────────────────────────────────────────────── */

function devColor(absPct) {
  return absPct < 1 ? T.green : absPct < 3 ? T.warnLine : T.red;
}

/* valueText: 표기 단위로 포맷된 환율 문자열 — 내부 값은 1단위당 원,
   표시는 통화 관행(엔 100 기준 등)을 따르므로 포맷은 호출부가 소유 */
function SourceRow({ name, valueText, dev, error, badge }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "6px 0", borderTop: `1px solid ${T.line}` }}>
      <span style={{ flex: 1, fontSize: 12.5, color: T.muted, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name}{badge && <em style={{ fontStyle: "normal", fontSize: 10.5, color: T.indigo, marginLeft: 6 }}>{badge}</em>}
      </span>
      {error ? (
        <span style={{ fontSize: 12, color: T.red }}>{error}</span>
      ) : (
        <>
          <span style={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{valueText}</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: devColor(Math.abs(dev)), width: 58, textAlign: "right" }}>
            {isNaN(dev) ? "" : (dev > 0 ? "+" : "") + dev.toFixed(2) + "%"}
          </span>
        </>
      )}
    </div>
  );
}

export default function AnomalyCheck({ rateAlert }) {
  const { cur, unit, unitLabel, unitText } = rateAlert;
  // 표기 단위 환율 문자열 — 내부 값은 1단위당 원 (엔은 100엔 기준으로 표시)
  const fmtRate = (n) => (isNaN(n) ? "—" : (n * unit).toFixed(2) + "원");

  // ── 이상 감지 — 알림 통화를 따라간다 ──
  const [check, setCheck] = useState({ phase: "idle", rows: [], bank: null, live: null, at: null });
  const [myBankRate, setMyBankRate] = useState("");

  const runCheck = useCallback(async (currency) => {
    // 통화 전환 직후 옛 통화의 행이 남지 않도록 행까지 비운다
    setCheck({ phase: "loading", rows: [], bank: null, live: null, at: null });
    try {
      const [rows, bank, liveRaw] = await Promise.all([
        fetchKrwAll(currency),
        fetch(`/api/bank-rate?cur=${currency}`, { signal: timeoutSignal(10_000) })
          .then((r) => r.json())
          .catch(() => null),
        fetch("/api/live-rate", { signal: timeoutSignal(10_000) })
          .then((r) => (r.headers.get("content-type")?.includes("json") ? r.json() : null))
          .catch(() => null),
      ]);
      // 장중 소스는 krwPer 맵 — 조회 시점 통화의 값만 뽑아 둔다
      const liveKrw = liveRaw?.krwPer?.[currency] ?? (currency === "JPY" ? liveRaw?.jpyKrw : null);
      const live = liveKrw ? { source: liveRaw.source, krw: liveKrw } : null;
      setCheck({ phase: "done", rows, bank, live, at: Date.now() });
    } catch {
      // 예기치 못한 실패로 "검사 중"에 잠기지 않도록 — 전 소스 실패로 처리
      setCheck({ phase: "done", rows: [], bank: null, live: null, at: Date.now() });
    }
  }, []);
  // 통화가 바뀌면 내 은행 환율 입력도 단위 의미가 달라지므로 함께 비운다
  useEffect(() => { setMyBankRate(""); runCheck(cur); }, [cur, runCheck]);

  const analysis = useMemo(() => {
    const ok = check.rows.filter((r) => r.ok);
    const med = median(ok.map((r) => r.krw));
    const rows = check.rows.map((r) =>
      r.ok ? { ...r, dev: deviationPct(r.krw, med) } : r
    );
    const bankDev = check.bank?.krw ? deviationPct(check.bank.krw, med) : NaN;
    const liveDev = check.live?.krw ? deviationPct(check.live.krw, med) : NaN;
    const devs = [
      ...rows.filter((r) => r.ok).map((r) => Math.abs(r.dev)),
      ...(isNaN(bankDev) ? [] : [Math.abs(bankDev)]),
      ...(isNaN(liveDev) ? [] : [Math.abs(liveDev)]),
    ];
    const maxDev = devs.length ? Math.max(...devs) : NaN;
    const level =
      ok.length < 2 ? "insufficient" : maxDev < 1 ? "ok" : maxDev < 3 ? "warn" : "danger";
    return { rows, med, bankDev, liveDev, maxDev, level, okCount: ok.length };
  }, [check]);

  // 입력은 표기 단위 기준(엔은 100엔). 엔만 예외 인식: 1엔당 원화가 100원을
  // 넘을 일은 없으므로 100 미만 입력은 1엔 기준으로 보고 자동 환산한다
  const myRaw = parseFloat(myBankRate);
  const myPer1 = cur === "JPY" && myRaw > 0 && myRaw < 100;
  const my = myPer1 ? myRaw : myRaw / unit; // 내부 비교값은 1단위당 원
  const myDev = my > 0 ? deviationPct(my, analysis.med) : NaN;

  return (
    <section style={{ ...panel(), padding: "16px 16px 6px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, marginBottom: 4, flex: 1 }}>
          ⚠️ 환율 이상 감지 ({unitLabel}화)
        </div>
        <button onClick={() => runCheck(cur)} disabled={check.phase === "loading"} style={chipBtn()}>
          {check.phase === "loading" ? "검사 중…" : "다시 검사"}
        </button>
      </div>
      <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, margin: "0 0 12px" }}>
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
              <span style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{fmtRate(analysis.med)}</span>
              <span style={{ width: 58 }} />
            </div>
            {analysis.rows.map((r) => (
              <SourceRow key={r.name} name={r.name} valueText={fmtRate(r.krw)} dev={r.dev} error={r.ok ? null : "조회 실패"} />
            ))}
            {check.live?.krw && (
              <SourceRow name={check.live.source} badge="장중" valueText={fmtRate(check.live.krw)} dev={analysis.liveDev} />
            )}
            {check.bank?.krw && (
              <SourceRow name={check.bank.source} badge={check.bank.date} valueText={fmtRate(check.bank.krw)} dev={analysis.bankDev} />
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
            background: analysis.level === "ok" ? T.greenSoft : analysis.level === "danger" ? T.redSoft : T.warnBg,
            color: analysis.level === "ok" ? T.green : analysis.level === "danger" ? T.red : T.warnInk,
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
          label="내 은행/앱에 표시된 환율 (선택)" suffix={`원 / ${unitText}`}
          value={myBankRate} onChange={setMyBankRate}
          hint={`토스·하나·신한 등 앱에 보이는 ${unitText} 기준 환율을 입력하면 시장 기준과 비교합니다${cur === "JPY" ? " (1엔 기준 입력도 자동 인식)" : ""}`}
        />
        {my > 0 && !isNaN(myDev) && (
          <div style={{
            borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, lineHeight: 1.7,
            background: Math.abs(myDev) < 3 ? T.greenSoft : T.redSoft,
            color: Math.abs(myDev) < 3 ? T.green : T.red, fontWeight: 600,
          }}>
            {myPer1 && (
              <span style={{ display: "block", fontSize: 11.5, opacity: 0.85, marginBottom: 4 }}>
                1엔 기준 환율로 보여 100엔당 {(my * 100).toFixed(2)}원으로 환산해 비교했습니다.
              </span>
            )}
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
  );
}
