import { useState } from "react";
import { T, chipBtn, panel, StepList } from "./ui.jsx";
import { PCCC_URL, CARGO_TRACK_URL } from "./lib/clearance.js";
import { timeoutSignal } from "./lib/net.js";

/* ──────────────────────────────────────────────
   해외 배송 통관조회 (전역 접이식 패널 — 환율 설정 아래, 어느 탭에서든 열 수 있다)
   특송업체·EMS가 알려주는 화물관리번호("통관번호")로 UNI-PASS
   화물통관진행정보(/api/cargo-status)를 조회해 지금 어느 단계인지 보여준다.
   특정 계산과 묶여 있지 않은 독립 조회라 TrendPanel처럼 전역에 둔다.
   열림 상태는 localStorage에 저장 — 한 번 펼치면 재방문에도 유지된다.
   ────────────────────────────────────────────── */
const OPEN_KEY = "yen-calc:cargo-open:v1";

export default function CargoStatus() {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(OPEN_KEY) === "1"; } catch { return false; }
  });
  const toggle = () =>
    setOpen((o) => {
      const next = !o;
      try { localStorage.setItem(OPEN_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });

  const [no, setNo] = useState("");
  const [st, setSt] = useState({ phase: "idle" }); // idle|loading|done|error

  const lookup = async () => {
    const trimmed = no.trim();
    if (!trimmed) {
      setSt({ phase: "error", msg: "화물관리번호를 입력해 주세요" });
      return;
    }
    setSt({ phase: "loading" });
    try {
      const r = await fetch(`/api/cargo-status?no=${encodeURIComponent(trimmed)}`, { signal: timeoutSignal(10_000) });
      if (!r.headers.get("content-type")?.includes("json")) {
        throw new Error("통관조회 API에 연결할 수 없습니다 (로컬 개발 시 vercel dev 필요)");
      }
      const d = await r.json();
      if (!d.configured) throw new Error("서버에 통관조회 API 키(UNIPASS_CARGO_API_KEY)가 없습니다");
      if (d.error) throw new Error(d.error);
      setSt({ phase: "done", data: d });
    } catch (e) {
      setSt({ phase: "error", msg: e.name === "TimeoutError" ? "응답 시간 초과 — 다시 시도해 주세요" : e.message });
    }
  };

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
        📦 해외 배송 통관조회 {open ? "접기" : "보기"}
        <span style={{ fontWeight: 600, color: T.muted, fontSize: 11 }}>
          (화물관리번호로 진행 단계 확인{open ? "" : " · 어느 탭에서든"})
        </span>
      </button>
      {open && (
        <section style={{ ...panel(), padding: "16px 16px 14px", marginTop: 8 }}>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
            특송업체(배대지)·판매자가 알려주는 화물관리번호(운송장번호와 다를 수 있음)를 입력하면
            UNI-PASS 화물통관진행정보로 지금 어느 단계인지 조회합니다.
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={no} onChange={(e) => setNo(e.target.value)} placeholder="예: 20260713K1234567"
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              aria-label="화물관리번호"
              style={{
                flex: 1, minWidth: 0, border: `1.5px solid ${T.line}`, borderRadius: 8,
                background: T.field, padding: "9px 10px", fontSize: 16, fontWeight: 600,
                color: T.ink, outline: "none",
              }}
            />
            <button onClick={lookup} disabled={st.phase === "loading"} style={chipBtn({ solid: true })}>
              {st.phase === "loading" ? "조회 중…" : "조회"}
            </button>
          </div>

          {st.phase === "error" && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: T.red, fontWeight: 600 }}>{st.msg}</p>
          )}

          {st.phase === "done" && (
            <div style={{ marginTop: 10 }}>
              {st.data.info && (
                <p style={{ margin: "0 0 8px", fontSize: 11.5, color: T.muted, lineHeight: 1.6 }}>
                  {st.data.info.shipName && <>선박/항공편 {st.data.info.shipName} · </>}
                  {st.data.info.cargoType && <>{st.data.info.cargoType} · </>}
                  {st.data.info.arrivedAt && <>입항일 {st.data.info.arrivedAt}</>}
                </p>
              )}
              <div style={{ background: T.subtle, border: `1px solid ${T.line}`, borderRadius: 10, padding: "4px 12px 8px" }}>
                <StepList
                  items={st.data.steps.map((s, i) => ({
                    key: i,
                    title: s.status,
                    desc: (s.code || s.date) && [s.code && `코드 ${s.code}`, s.date].filter(Boolean).join(" · "),
                  }))}
                />
              </div>
            </div>
          )}

          <p style={{ margin: "10px 0 0", fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
            화물관리번호를 모르면{" "}
            <a href={CARGO_TRACK_URL} target="_blank" rel="noreferrer" style={{ color: T.indigo, fontWeight: 700 }}>UNI-PASS</a>
            에서 운송장번호로 직접 찾을 수 있습니다. 통관에는{" "}
            <a href={PCCC_URL} target="_blank" rel="noreferrer" style={{ color: T.indigo, fontWeight: 700 }}>개인통관고유부호</a>
            가 필요합니다.
          </p>
        </section>
      )}
    </div>
  );
}
