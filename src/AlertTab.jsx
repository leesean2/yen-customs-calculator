import { useEffect, useState } from "react";
import { T, NumField, SelectField, CheckField, chipBtn, panel } from "./ui.jsx";
import { ORIGIN_COUNTRIES } from "./data/countries.js";
import { pushSupported, getPushSubscription, subscribePush, unsubscribePush } from "./lib/push.js";

/* ──────────────────────────────────────────────
   환율 알림 탭 — 목표 환율 알림 설정 UI (상태는 useRateAlert/App 소유)
   추이 차트·이상 감지는 전역(App의 TrendPanel — 환율 설정 아래)으로 옮겨졌고,
   통화·목표선은 여전히 이 탭의 설정을 따라간다.
   ────────────────────────────────────────────── */

const sectionStyle = { ...panel(), padding: "16px 16px 6px", marginBottom: 14 };
const titleStyle = { fontSize: 13.5, fontWeight: 800, color: T.ink, marginBottom: 4 };
const descStyle = { fontSize: 12, color: T.muted, lineHeight: 1.6, margin: "0 0 12px" };

/* 백그라운드 푸시 구독 — 탭을 닫아도 서버(크론)가 하루 1회 확인 후 발송
   목표 통화(cur)도 함께 저장되어 크론이 그 통화의 환율로 판정한다 */
function PushBlock({ config }) {
  const [st, setSt] = useState({ phase: "checking", error: null });

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!pushSupported()) return mounted && setSt({ phase: "unsupported" });
      const sub = await getPushSubscription();
      if (mounted) setSt({ phase: sub ? "subscribed" : "idle" });
    })();
    return () => { mounted = false; };
  }, []);

  const doSubscribe = async () => {
    setSt({ phase: "busy" });
    try {
      if (Notification.permission !== "granted") {
        const p = await Notification.requestPermission();
        if (p !== "granted") throw new Error("브라우저 알림 권한이 필요합니다");
      }
      await subscribePush({
        target: config.target,
        dir: config.dir,
        cur: config.cur || "JPY",
        anomaly: true,
      });
      setSt({ phase: "subscribed" });
    } catch (e) {
      setSt({ phase: "error", error: e.message });
    }
  };
  const doUnsubscribe = async () => {
    setSt({ phase: "busy" });
    try {
      await unsubscribePush();
      setSt({ phase: "idle" });
    } catch (e) {
      setSt({ phase: "error", error: e.message });
    }
  };

  return (
    <div style={{ borderTop: `1px dashed ${T.line}`, paddingTop: 12, marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: T.ink, marginBottom: 4 }}>📲 백그라운드 푸시 (탭을 닫아도 알림)</div>
      <p style={{ ...descStyle, margin: "0 0 10px" }}>
        구독하면 서버가 하루 1회(오전 10시경) 환율을 확인해 목표 도달·이상 감지 시 푸시를 보냅니다.
        같은 알림은 하루 1회만 발송됩니다. 목표 환율이나 통화를 바꾸면 &lsquo;목표 다시 반영&rsquo;을 눌러 주세요.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {st.phase === "checking" && <span style={{ fontSize: 12, color: T.muted }}>구독 상태 확인 중…</span>}
        {st.phase === "unsupported" && <span style={{ fontSize: 12, color: T.muted }}>이 브라우저는 웹 푸시를 지원하지 않습니다. (iOS는 홈 화면에 추가 후 지원)</span>}
        {st.phase === "busy" && <span style={{ fontSize: 12, color: T.muted }}>처리 중…</span>}
        {st.phase === "idle" && (
          <button onClick={doSubscribe} style={chipBtn({ solid: true })}>푸시 구독하기</button>
        )}
        {st.phase === "subscribed" && (
          <>
            <span style={{ fontSize: 12, color: T.green, fontWeight: 700 }}>✓ 푸시 구독 중</span>
            <button onClick={doSubscribe} style={chipBtn()}>목표 다시 반영</button>
            <button onClick={doUnsubscribe} style={chipBtn({ color: T.red })}>구독 해제</button>
          </>
        )}
        {st.phase === "error" && (
          <>
            <span style={{ fontSize: 12, color: T.red }}>{st.error}</span>
            <button onClick={doSubscribe} style={chipBtn()}>다시 시도</button>
          </>
        )}
      </div>
      {(st.phase === "idle" || st.phase === "subscribed") && !(parseFloat(config.target) > 0) && (
        <p style={{ fontSize: 11, color: T.muted, margin: "0 0 10px" }}>
          목표 환율이 비어 있으면 이상 감지 경고만 푸시로 받습니다.
        </p>
      )}
    </div>
  );
}

export default function AlertTab({ rateAlert }) {
  const { config, update, triggered, live, liveText, unitText } = rateAlert;

  // ── 브라우저 알림 권한 ──
  const [notifPerm, setNotifPerm] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const askPermission = async () => {
    if (typeof Notification === "undefined") return;
    setNotifPerm(await Notification.requestPermission());
  };

  return (
    <>
      {/* ── 1. 목표 환율 알림 ── */}
      <section style={sectionStyle}>
        <div style={titleStyle}>🔔 목표 환율 알림</div>
        <p style={descStyle}>
          현재 {unitText} = <b style={{ color: T.ink }}>{live > 0 ? liveText + "원" : "—"}</b>.
          목표에 도달하면 앱 상단 배너와 브라우저 알림으로 알려드립니다.
          (탭이 열려 있는 동안 10분마다 확인 · 실시간 시세 소스라 수 분 단위로 갱신됩니다)
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* 통화를 바꾸면 목표가 단위 의미가 달라지므로 비워서 오알림을 막는다 */}
          <SelectField label="통화" value={config.cur || "JPY"} onChange={(v) => update({ cur: v, target: "" })}>
            {ORIGIN_COUNTRIES.map((c) => (
              <option key={c.currency} value={c.currency}>
                {c.flag} {c.rateUnitLabel} ({c.currency})
              </option>
            ))}
          </SelectField>
          <NumField label="목표 환율" suffix={`원 / ${unitText}`} value={config.target} onChange={(v) => update({ target: v })} />
          <SelectField label="조건" value={config.dir} onChange={(v) => update({ dir: v })}>
            <option value="below">이하로 내려가면 (살 때 유리)</option>
            <option value="above">이상으로 올라가면</option>
          </SelectField>
        </div>

        <CheckField label="알림 활성화" checked={config.enabled} onChange={(v) => update({ enabled: v })} />

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {notifPerm === "default" && (
            <button onClick={askPermission} style={chipBtn()}>
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
            🎯 목표 도달! 현재 {unitText} = {liveText}원 — 목표 {config.target}원 {config.dir === "below" ? "이하" : "이상"}
          </div>
        )}

        <PushBlock config={config} />
      </section>

      {/* 환율 추이 차트·이상 감지는 전역(App의 TrendPanel — 환율 설정 아래)에 있고,
          통화·목표선이 이 탭의 설정을 따라간다 */}

      <p style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.7, marginTop: 14 }}>
        · 화면 배너·브라우저 알림은 탭이 열려 있는 동안 10분 주기로, 백그라운드 푸시는 서버가 하루 1회 확인해 발송합니다.<br />
        · 환율은 실시간 시세 소스(수 분 단위) 기준이며, 실패 시 일간 소스로 폴백합니다. 실제 환전가는 은행 스프레드에 따라 다릅니다.
      </p>
    </>
  );
}
