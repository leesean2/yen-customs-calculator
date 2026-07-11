import { useEffect, useRef, useState } from "react";
import { T, money, won, chipBtn, panel } from "./ui.jsx";
import { todayStr, exportOrders, parseImportedOrders } from "./lib/orders.js";
import { getCountry } from "./data/countries.js";

/* 구매 이력 카드 — 기록 버튼 + 최근 목록 + 이번 달 지출 요약 + JSON 백업/복원 (직구 탭 하단) */
export default function OrderHistoryCard({ orders, canRecord, onRecord, onRemove, onImport }) {
  const [justSaved, setJustSaved] = useState(false);
  const [ioMsg, setIoMsg] = useState(null); // { ok, text } — 가져오기 결과 안내
  const timerRef = useRef(null);
  const fileRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const record = () => {
    onRecord();
    setJustSaved(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setJustSaved(false), 2500);
  };

  // 내보내기 — 이력 전체를 JSON 파일로 다운로드 (서버 전송 없음)
  const doExport = () => {
    const blob = new Blob([exportOrders(orders)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yen-calc-orders-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 가져오기 — 내보낸 JSON을 병합 (id 중복은 유지, 60일 지난 기록은 제외)
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택도 change가 발생하도록
    if (!file) return;
    try {
      const imported = parseImportedOrders(await file.text());
      const added = onImport(imported);
      setIoMsg({ ok: true, text: `✓ ${added}건 가져옴 (중복·60일 경과 기록 제외)` });
    } catch {
      setIoMsg({ ok: false, text: "가져오기 실패 — 이 앱에서 내보낸 JSON 파일인지 확인하세요" });
    }
  };

  // 이번 달 지출 요약 — 세금은 taxKrw가 기록된 주문(신규 형식)만 합산한다
  const monthKey = todayStr().slice(0, 7); // YYYY-MM
  const monthOrders = orders.filter((o) => o.date?.startsWith(monthKey));
  const monthGoodsJpy = monthOrders.reduce((sum, o) => sum + o.goodsJpy, 0);
  const monthTaxKrw = monthOrders.reduce((sum, o) => sum + (o.taxKrw || 0), 0);
  // 물품가 합계는 통화가 하나일 때만 의미가 있다 — 출발국이 섞인 달은 합계를 숨긴다
  const monthCountryIds = [...new Set(monthOrders.map((o) => o.country ?? "JP"))];
  const monthCountry = monthCountryIds.length === 1 ? getCountry(monthCountryIds[0]) : null;

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
      {monthOrders.length > 0 && (
        <div style={{
          display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap",
          background: T.subtle, border: `1px solid ${T.line}`, borderRadius: 8,
          padding: "8px 10px", marginBottom: 8, fontSize: 12, color: T.muted, fontWeight: 600,
        }}>
          <span style={{ color: T.ink, fontWeight: 800 }}>이번 달</span>
          <span>주문 {monthOrders.length}건</span>
          {monthCountry && (
            <>
              <span>·</span>
              <span>물품 <b style={{ color: T.ink, fontVariantNumeric: "tabular-nums" }}>{money(monthGoodsJpy, monthCountry)}</b></span>
            </>
          )}
          <span>·</span>
          <span>예상 세금 <b style={{ color: monthTaxKrw > 0 ? T.red : T.ink, fontVariantNumeric: "tabular-nums" }}>{won(monthTaxKrw)}</b></span>
        </div>
      )}
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
              <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{money(o.goodsJpy, getCountry(o.country))}</span>
              <button onClick={() => onRemove(o.id)} aria-label="삭제" style={{
                border: "none", background: "transparent", color: T.muted, cursor: "pointer", fontSize: 14, padding: "0 2px", flexShrink: 0,
              }}>×</button>
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${T.line}` }}>
        <button onClick={doExport} disabled={orders.length === 0} style={chipBtn({ disabled: orders.length === 0 })}>
          ⬇ 내보내기 (JSON)
        </button>
        <button onClick={() => fileRef.current?.click()} style={chipBtn()}>
          ⬆ 가져오기
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" onChange={onFile} style={{ display: "none" }} />
        {ioMsg && (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: ioMsg.ok ? T.green : T.red }}>{ioMsg.text}</span>
        )}
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
        이력은 이 브라우저에만 저장되며(서버 전송 없음) 60일이 지나면 자동 삭제됩니다.
        브라우저를 바꾸거나 데이터를 지우기 전에 내보내기로 백업하세요.
      </p>
    </section>
  );
}
