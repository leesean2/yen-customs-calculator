import { T, won, money, subtleBox } from "./ui.jsx";
import { computeSnapshot, computeCombined } from "./lib/snapshot.js";

/* 저장함 비교 보기 (SavedCalcsCard 하단) — 선택한 저장 항목 2~3건을 저장 시점
   스냅샷으로 재계산해 나란히 보여주고, 같은 출발국이면 '한 주문으로 합산과세될
   때'와 대조한다. 각각은 면세라도 합치면 과세되는 게 직구의 흔한 함정이라,
   따로/합산의 세금 차이를 판정 문구로 앞세운다.
   entries: 선택된 저장 항목(최신순) */
export default function SavedCompareBlock({ entries }) {
  const cols = entries
    .map((entry) => ({ entry, snap: computeSnapshot(entry.query) }))
    .filter((c) => c.snap);
  if (cols.length < 2) return null;

  const sepTax = cols.reduce((sum, c) => sum + c.snap.shop.totalTax, 0);
  const sepFinal = cols.reduce((sum, c) => sum + c.snap.shop.final, 0);
  const combined = computeCombined(cols.map((c) => c.snap)); // 출발국 섞이면 null
  const delta = combined ? combined.totalTax - sepTax : 0;

  const cell = { padding: "5px 6px", fontSize: 12, fontVariantNumeric: "tabular-nums", textAlign: "right" };
  const head = { ...cell, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 0 };
  const rowLabel = { ...cell, textAlign: "left", color: T.muted, fontWeight: 600, whiteSpace: "nowrap" };

  const rows = [
    ["물품가격", (c) => money(c.snap.shop.goodsJpy, c.snap.country)],
    ["판정", (c) => (
      <b style={{ color: c.snap.shop.taxed ? T.red : T.green }}>{c.snap.shop.taxed ? "과세" : "면세"}</b>
    )],
    ["세금", (c) => won(c.snap.shop.totalTax)],
    ["최종 비용", (c) => <b>{won(c.snap.shop.final)}</b>],
  ];

  return (
    <div style={{ marginTop: 8, ...subtleBox("8px 10px") }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={rowLabel} />
              {cols.map((c) => (
                <th key={c.entry.id} style={head} title={c.entry.name}>
                  {c.snap.country.flag} {c.entry.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, render]) => (
              <tr key={label} style={{ borderTop: `1px solid ${T.line}` }}>
                <td style={rowLabel}>{label}</td>
                {cols.map((c) => <td key={c.entry.id} style={cell}>{render(c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ borderTop: `1.5px solid ${T.ink}`, marginTop: 4, paddingTop: 6, fontSize: 12, lineHeight: 1.7 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
          <span style={{ color: T.muted }}>따로 주문 합계</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>세금 {won(sepTax)} · 최종 {won(sepFinal)}</span>
        </div>
        {combined ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span style={{ color: T.muted }}>합산과세 시</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: delta > 0 ? T.red : T.ink }}>
                세금 {won(combined.totalTax)} · 최종 {won(combined.final)}
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 11.5, fontWeight: 700, color: delta > 0 ? T.red : T.green }}>
              {delta > 0
                ? `⚠️ 같은 날 같은 판매자로 주문하면 합산과세로 세금이 ${won(delta)} 늘 수 있습니다 — 주문일이나 판매자를 나누세요.`
                : "합산과세돼도 세금 차이가 없습니다 — 함께 주문해도 됩니다."}
            </p>
          </>
        ) : (
          <p style={{ margin: "2px 0 0", fontSize: 11.5, color: T.muted }}>
            출발국이 서로 달라 합산과세 비교는 제공하지 않습니다 (다른 나라 주문은 합산되지 않습니다).
          </p>
        )}
        <p style={{ margin: "4px 0 0", fontSize: 10.5, color: T.muted, lineHeight: 1.5 }}>
          각 열은 저장 시점의 환율 기준이며, 합산 계산은 가장 최근 저장의 환율을 씁니다.
        </p>
      </div>
    </div>
  );
}
