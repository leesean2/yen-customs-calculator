import { T, Disclosure } from "./ui.jsx";

/* 결과 카드 하단 '계산 근거 펼쳐보기' 토글 (직구·여행자 탭 공용)
   세액이 어떤 수식으로 나왔는지 입력값이 대입된 단계별 수식을 보여준다 —
   계산기가 블랙박스로 보이면 사용자가 결과를 신뢰하기 어렵다.
   steps: [{ label, expr, note? }] — falsy 항목은 걸러지므로 조건부로 넣기 편하다. */
export default function CalcBreakdown({ steps }) {
  const items = steps.filter(Boolean);

  return (
    <Disclosure label={(open) => (open ? "계산 근거 접기" : "계산 근거 펼쳐보기")}>
      <div style={{ marginTop: 10, background: T.subtle, border: `1px solid ${T.line}`, borderRadius: 10, padding: "4px 12px 8px" }}>
        {items.map((s, i) => (
          <div key={i} style={{ padding: "8px 0", borderTop: i ? `1px solid ${T.line}` : "none" }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.indigo, marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, lineHeight: 1.6, fontVariantNumeric: "tabular-nums", wordBreak: "keep-all" }}>
              {s.expr}
            </div>
            {s.note && <div style={{ fontSize: 11, color: T.muted, marginTop: 2, lineHeight: 1.5 }}>{s.note}</div>}
          </div>
        ))}
        <p style={{ margin: "8px 0 2px", fontSize: 10.5, color: T.muted, lineHeight: 1.5 }}>
          금액은 원 단위 반올림으로 표시되어 단계별 합계가 최종 금액과 ±1원 차이 날 수 있습니다.
        </p>
      </div>
    </Disclosure>
  );
}

/** 환율 표기: 1엔당 원화(jr) → "1,000원/100엔" 꼴 */
export function rate100Text(jr) {
  return (jr * 100).toLocaleString("ko-KR", { maximumFractionDigits: 2 }) + "원/100엔";
}
