import { useState } from "react";
import { T, chipBtn, linkBtn } from "./ui.jsx";
import { timeoutSignal } from "./lib/net.js";

/* ──────────────────────────────────────────────
   HS부호 정확 관세율 (직구 탭 상품 행의 선택 기능)
   품목 카테고리는 대푯값이라, 상품의 HS부호(10자리)를 알면 관세청
   관세율기본조회(/api/tariff-rate)로 실제 세율을 받아 그 상품에 적용한다.
   applied: { hs, rate(%) } | null — 적용 상태는 상품 행(부모)이 소유
   ────────────────────────────────────────────── */
export default function HsRateField({ applied, onApply, onClear }) {
  const [open, setOpen] = useState(false);
  const [hs, setHs] = useState("");
  const [st, setSt] = useState({ phase: "idle" }); // idle|loading|done|error

  const lookup = async () => {
    const code = hs.replace(/\D/g, "");
    if (code.length !== 10) {
      setSt({ phase: "error", msg: "HS부호는 숫자 10자리입니다 (예: 8471300000)" });
      return;
    }
    setSt({ phase: "loading" });
    try {
      const r = await fetch(`/api/tariff-rate?hs=${code}`, { signal: timeoutSignal(10_000) });
      if (!r.headers.get("content-type")?.includes("json")) {
        throw new Error("관세율 API에 연결할 수 없습니다 (로컬 개발 시 vercel dev 필요)");
      }
      const d = await r.json();
      if (!d.configured) throw new Error("서버에 관세율 API 키(UNIPASS_TARIFF_API_KEY)가 없습니다");
      if (d.error) throw new Error(d.error);
      setSt({ phase: "done", data: d });
    } catch (e) {
      setSt({ phase: "error", msg: e.name === "TimeoutError" ? "응답 시간 초과 — 다시 시도해 주세요" : e.message });
    }
  };

  if (applied) {
    return (
      <p style={{ margin: "-6px 0 14px", fontSize: 11.5, color: T.green, fontWeight: 700 }}>
        ✓ HS {applied.hs} 관세율 {applied.rate}% 적용 중 (품목 대푯값 대신)
        <button onClick={onClear} style={{ ...linkBtn, marginLeft: 6 }}>해제</button>
      </p>
    );
  }

  return (
    <div style={{ margin: "-6px 0 14px" }}>
      <button onClick={() => setOpen((o) => !o)} style={linkBtn} aria-expanded={open}>
        {open ? "▾" : "▸"} HS부호로 정확 관세율 적용 (선택)
      </button>
      {open && (
        <div style={{ marginTop: 6 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={hs} onChange={(e) => setHs(e.target.value)} placeholder="HS부호 10자리"
              inputMode="numeric" maxLength={13}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              aria-label="HS부호"
              style={{
                flex: 1, minWidth: 0, border: `1.5px solid ${T.line}`, borderRadius: 8,
                background: T.field, padding: "7px 10px", fontSize: 16, fontWeight: 600,
                color: T.ink, outline: "none",
              }}
            />
            <button onClick={lookup} disabled={st.phase === "loading"} style={chipBtn({ solid: true })}>
              {st.phase === "loading" ? "조회 중…" : "세율 조회"}
            </button>
          </div>
          <p style={{ margin: "5px 0 0", fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
            상품의 HS부호는 판매 페이지·관세청{" "}
            <a href="https://unipass.customs.go.kr/clip/index.do" target="_blank" rel="noreferrer" style={{ color: T.indigo, fontWeight: 700 }}>품목분류</a>
            에서 찾을 수 있습니다.
          </p>
          {st.phase === "error" && (
            <p style={{ margin: "6px 0 0", fontSize: 11.5, color: T.red, fontWeight: 600 }}>{st.msg}</p>
          )}
          {st.phase === "done" && (
            <div style={{ marginTop: 6, fontSize: 11.5, color: T.ink, fontWeight: 600, lineHeight: 1.6 }}>
              기본세율 {st.data.base ?? "—"}%{st.data.wto != null && ` · WTO협정 ${st.data.wto}%`} →{" "}
              적용 <b>{st.data.applied}%</b> ({st.data.appliedName})
              <button
                onClick={() => onApply({ hs: st.data.hs, rate: st.data.applied })}
                style={{ ...chipBtn(), marginLeft: 8 }}
              >
                이 세율 적용
              </button>
              {st.data.ftaMin && (
                <span style={{ display: "block", color: T.muted, fontWeight: 500 }}>
                  {st.data.ftaMin.name} {st.data.ftaMin.rate}% — 원산지 증명 시 더 낮아질 수 있습니다.
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
