import { useEffect, useRef, useState } from "react";
import { T, yen, panel } from "./ui.jsx";

/* 구매 이력 카드 — 기록 버튼 + 최근 목록 (직구 탭 하단) */
export default function OrderHistoryCard({ orders, canRecord, onRecord, onRemove }) {
  const [justSaved, setJustSaved] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const record = () => {
    onRecord();
    setJustSaved(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setJustSaved(false), 2500);
  };

  return (
    <section style={{ ...panel(), padding: "16px 16px 12px", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: T.ink }}>
          🧾 구매 이력 <span style={{ fontWeight: 600, color: T.muted, fontSize: 12 }}>({orders.length}건 · 최근 60일)</span>
        </div>
        <button
          onClick={record}
          disabled={!canRecord}
          style={{
            border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700,
            cursor: canRecord ? "pointer" : "not-allowed",
            background: canRecord ? T.indigo : T.line, color: canRecord ? "#fff" : T.muted,
          }}>
          {justSaved ? "✓ 기록됨" : "이 주문 기록"}
        </button>
      </div>
      {orders.length === 0 ? (
        <p style={{ margin: "4px 0 6px", fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
          판매자를 입력하고 주문을 기록해 두면, 다음에 같은 판매자에게 같은 날 주문할 때 합산과세 위험을 자동으로 경고합니다.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {orders.slice(0, 10).map((o) => (
            <li key={o.id} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "6px 0", borderTop: `1px solid ${T.line}`, fontSize: 12.5 }}>
              <span style={{ color: T.muted, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{o.date}</span>
              <span style={{ fontWeight: 700, color: T.ink, flexShrink: 0 }}>{o.seller}</span>
              <span style={{ color: T.muted, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{o.item}</span>
              <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{yen(o.goodsJpy)}</span>
              <button onClick={() => onRemove(o.id)} aria-label="삭제" style={{
                border: "none", background: "transparent", color: T.muted, cursor: "pointer", fontSize: 14, padding: "0 2px", flexShrink: 0,
              }}>×</button>
            </li>
          ))}
        </ul>
      )}
      <p style={{ margin: "8px 0 0", fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
        이력은 이 브라우저에만 저장되며(서버 전송 없음) 60일이 지나면 자동 삭제됩니다.
      </p>
    </section>
  );
}
