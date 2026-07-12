import { useState } from "react";
import { T, won, linkBtn, subtleBox, Disclosure } from "./ui.jsx";
import { PAYMENT_METHODS, loadPaymentRates, savePaymentRates, paymentRows } from "./lib/payment.js";

/* 결제 수단별 최종 비용 비교 (직구 탭 결과 카드 접이식) — 해외 결제 수수료를
   외화 결제 금액에 얹어 수단별 총액을 나란히 보여준다. 요율은 셀에서 바로
   고쳐 쓰고 브라우저에 저장된다(빈 값이면 기본값 복귀).
   foreignKrw: 외화 결제 금액(물품가+현지 배송, 원화 환산) · finalKrw: 수수료 전 최종 비용 */
export default function PaymentCompare({ foreignKrw, finalKrw }) {
  const [rates, setRates] = useState(loadPaymentRates);
  // 입력 중간 상태(빈 문자열·소수점 타이핑)를 요율과 분리해 셀이 튀지 않게 한다
  const [editing, setEditing] = useState({}); // { 수단id: 입력 문자열 }

  const persist = (next) => { setRates(next); savePaymentRates(next); };
  const commit = (id, text) => {
    const v = parseFloat(text);
    if (Number.isFinite(v) && v >= 0 && v <= 20) persist({ ...rates, [id]: v });
    else { const { [id]: _, ...rest } = rates; persist(rest); } // 빈/이상 값 → 기본값 복귀
    setEditing((e) => ({ ...e, [id]: undefined }));
  };

  const rows = paymentRows({ foreignKrw, finalKrw, rates });
  const cell = { padding: "6px 6px", fontSize: 12, fontVariantNumeric: "tabular-nums", textAlign: "right", whiteSpace: "nowrap" };

  return (
    <Disclosure label="결제 수단별 최종 비용 비교">
      <div style={{ marginTop: 10, ...subtleBox("8px 10px") }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ fontSize: 11, color: T.muted }}>
                <th style={{ ...cell, textAlign: "left", fontWeight: 600 }}>결제 수단</th>
                <th style={{ ...cell, fontWeight: 600 }}>수수료율</th>
                <th style={{ ...cell, fontWeight: 600 }}>수수료</th>
                <th style={{ ...cell, fontWeight: 600 }}>최종 비용</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: `1px solid ${T.line}` }}>
                  <td style={{ ...cell, textAlign: "left", fontWeight: 700, color: T.ink, whiteSpace: "normal" }}>
                    {r.label}
                    {r.custom && <span style={{ fontSize: 10, color: T.indigo, fontWeight: 700 }}> 내 요율</span>}
                  </td>
                  <td style={cell}>
                    <input
                      type="number" inputMode="decimal" min="0" max="20" step="0.05"
                      aria-label={`${r.label} 수수료율`}
                      value={editing[r.id] ?? String(r.pct)}
                      onChange={(e) => setEditing((s) => ({ ...s, [r.id]: e.target.value }))}
                      onBlur={(e) => commit(r.id, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      style={{
                        width: 52, border: `1px solid ${T.line}`, borderRadius: 6, background: T.field,
                        padding: "3px 4px", fontSize: 12, fontWeight: 600, color: T.ink, outline: "none",
                        textAlign: "right", fontVariantNumeric: "tabular-nums",
                      }}
                    />{" "}%
                  </td>
                  <td style={cell}>{won(r.feeKrw)}</td>
                  <td style={{ ...cell, fontWeight: 700, color: r.cheapest ? T.green : T.ink }}>
                    {won(r.totalKrw)}
                    {r.cheapest && <span style={{ fontSize: 10, fontWeight: 800 }}> 최저</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: "7px 0 0", fontSize: 10.5, color: T.muted, lineHeight: 1.6 }}>
          수수료는 해외(외화) 결제 금액 {won(foreignKrw)}에만 붙습니다 — 국제 배송비(원화 청구)·세금(원화 납부)은 제외.
          요율은 대표치이니 내 카드 조건으로 고쳐 쓰세요(이 브라우저에 저장).
          실제 청구액은 결제 시점의 카드 브랜드 환율에 따라 달라질 수 있습니다.{" "}
          {Object.keys(rates).length > 0 && (
            <button onClick={() => persist({})} style={{ ...linkBtn, fontSize: 10.5 }}>기본값으로</button>
          )}
        </p>
        <ul style={{ margin: "5px 0 0", padding: "0 0 0 14px", fontSize: 10, color: T.muted, lineHeight: 1.6 }}>
          {PAYMENT_METHODS.map((m) => <li key={m.id}>{m.label}: {m.note}</li>)}
        </ul>
      </div>
    </Disclosure>
  );
}
