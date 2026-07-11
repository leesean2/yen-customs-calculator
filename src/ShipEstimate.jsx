import { useEffect, useState } from "react";
import { T, won, chipBtn, linkBtn, InlineFold } from "./ui.jsx";
import { estimateShipping, loadCustomShipRates, saveCustomShipRates } from "./lib/shipping.js";
import { BILLING_STEP_KG, MAX_PARCEL_KG, SHIPPING_RATES, SHIPPING_RATES_VERIFIED } from "./data/shipping.js";

/* ──────────────────────────────────────────────
   배대지 배송비 추정 (직구 탭 국제 배송비 입력란의 선택 기능)
   국제 배송비를 모르는 사용자가 무게·치수로 요율 추정치를 받아 입력란에
   채울 수 있게 한다. 요율은 대표값(data/shipping.js)이 기본이고, 자기
   배대지 요금표를 아는 사용자는 '내 요율'을 국가별로 저장해 덮어쓴다.
   onApply(costKrw): 추정 금액을 국제 배송비 입력란(부모 소유)에 적용
   ────────────────────────────────────────────── */
export default function ShipEstimateField({ countryId, onApply }) {
  const [weight, setWeight] = useState("");
  const [dims, setDims] = useState({ w: "", l: "", h: "" });
  // 적용된 '금액'을 기억한다 — 무게·출발국·요율이 바뀌어 추정치가 달라지면 표시가 저절로 풀린다
  const [appliedCost, setAppliedCost] = useState(null);

  // ── 내 배대지 요율 — 국가별 localStorage, 있으면 대표 요율 대신 쓴다 ──
  const [customRates, setCustomRates] = useState(loadCustomShipRates);
  const [editing, setEditing] = useState(null); // null | { base, step } (문자열 입력값)
  useEffect(() => setEditing(null), [countryId]); // 출발국 전환 시 편집 폼은 닫는다
  const custom = customRates[countryId] ?? null;
  const rate = custom ?? SHIPPING_RATES[countryId];

  const est = estimateShipping({
    countryId,
    weightKg: parseFloat(weight) || 0,
    w: parseFloat(dims.w) || 0,
    l: parseFloat(dims.l) || 0,
    h: parseFloat(dims.h) || 0,
    rate: custom,
  });
  const applied = est != null && appliedCost === est.costKrw;

  const setDim = (k) => (v) => setDims((d) => ({ ...d, [k]: v }));

  const persistRates = (next) => { setCustomRates(next); saveCustomShipRates(next); };
  const editBase = parseFloat(editing?.base), editStep = parseFloat(editing?.step);
  const editValid = editBase > 0 && editStep >= 0;
  const saveCustom = () => {
    if (!editValid) return;
    persistRates({ ...customRates, [countryId]: { base: editBase, step: editStep } });
    setEditing(null);
  };
  const clearCustom = () => {
    const { [countryId]: _, ...rest } = customRates;
    persistRates(rest);
  };

  if (!rate) return null; // 요율 없는 출발국 — 기능 자체를 숨긴다

  return (
    <InlineFold label={`무게로 배송비 추정 (배대지 ${custom ? "내 요율" : "대표 요율"})`}>
      <div style={{ marginTop: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 6 }}>
          <MiniNum label="실무게 kg" value={weight} onChange={setWeight} />
          <MiniNum label="가로 cm" value={dims.w} onChange={setDim("w")} />
          <MiniNum label="세로 cm" value={dims.l} onChange={setDim("l")} />
          <MiniNum label="높이 cm" value={dims.h} onChange={setDim("h")} />
        </div>
        <p style={{ margin: "5px 0 0", fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
          상자 치수(선택)를 넣으면 부피무게(가로×세로×높이÷6000)와 비교해 큰 쪽으로 청구됩니다.
        </p>
        {est && (
          <div style={{ marginTop: 6, fontSize: 11.5, color: T.ink, fontWeight: 600, lineHeight: 1.6 }}>
            {est.volumeKg > 0 && `부피무게 ${est.volumeKg}kg ${est.volumeApplied ? ">" : "≤"} 실무게 ${est.actualKg}kg → `}
            청구 무게 <b>{est.billedKg}kg</b>({BILLING_STEP_KG}kg 단위 올림) → 예상{" "}
            <b>{won(est.costKrw)}</b>
            <button
              onClick={() => { onApply(String(est.costKrw)); setAppliedCost(est.costKrw); }}
              style={{ ...chipBtn({ solid: applied }), marginLeft: 8 }}
            >
              {applied ? "✓ 적용됨" : "이 금액 적용"}
            </button>
            {est.overMaxKg && (
              <span style={{ display: "block", color: T.red, fontWeight: 600 }}>
                {MAX_PARCEL_KG}kg 초과 — 대부분의 배대지는 분할 배송이 필요해 실제 비용이 더 커질 수 있습니다.
              </span>
            )}
          </div>
        )}
        <p style={{ margin: "6px 0 0", fontSize: 10.5, color: T.muted, lineHeight: 1.5 }}>
          {custom
            ? <>내 요율 적용 중 — 첫 {BILLING_STEP_KG}kg {won(rate.base)} + {BILLING_STEP_KG}kg당 {won(rate.step)}.</>
            : <>첫 {BILLING_STEP_KG}kg {won(rate.base)} + {BILLING_STEP_KG}kg당 {won(rate.step)} 기준 추정치({SHIPPING_RATES_VERIFIED} 요율 확인).
              실제 요금은 배대지 업체·요금제에 따라 다르니 결제 전 업체 요금표를 확인하세요.</>}
          {" "}
          {editing == null && (
            <button
              onClick={() => setEditing({ base: String(rate.base), step: String(rate.step) })}
              style={{ ...linkBtn, fontSize: 10.5 }}
            >
              {custom ? "내 요율 수정" : "내 배대지 요율 입력"}
            </button>
          )}
          {custom && editing == null && (
            <>
              {" · "}
              <button onClick={clearCustom} style={{ ...linkBtn, fontSize: 10.5 }}>대표 요율로</button>
            </>
          )}
        </p>
        {editing != null && (
          <div style={{ marginTop: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 6, alignItems: "end" }}>
              <MiniNum label={`첫 ${BILLING_STEP_KG}kg 요금 ₩`} value={editing.base}
                onChange={(v) => setEditing((e) => ({ ...e, base: v }))} />
              <MiniNum label={`추가 ${BILLING_STEP_KG}kg당 ₩`} value={editing.step}
                onChange={(v) => setEditing((e) => ({ ...e, step: v }))} />
              <button onClick={saveCustom} disabled={!editValid} style={chipBtn({ solid: true, disabled: !editValid })}>
                요율 저장
              </button>
              <button onClick={() => setEditing(null)} style={chipBtn()}>취소</button>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 10.5, color: T.muted, lineHeight: 1.5 }}>
              이용 중인 배대지 요금표의 {countryId} 노선 값을 넣으면 이 브라우저에 저장됩니다.
            </p>
          </div>
        )}
      </div>
    </InlineFold>
  );
}

/* 좁은 그리드용 소형 숫자 입력 — NumField(17px·suffix)와 달리 라벨이 위에 얇게 붙는다 */
function MiniNum({ label, value, onChange }) {
  return (
    <label style={{ display: "block", minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: T.muted, marginBottom: 3 }}>
        {label}
      </span>
      <input
        type="number" inputMode="decimal" min="0" value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          // fontSize 16: iOS Safari 포커스 확대 방지 (ui.jsx 입력들과 같은 이유)
          width: "100%", border: `1.5px solid ${T.line}`, borderRadius: 8, background: T.field,
          padding: "7px 8px", fontSize: 16, fontWeight: 600, color: T.ink, outline: "none",
          fontVariantNumeric: "tabular-nums", boxSizing: "border-box",
        }}
      />
    </label>
  );
}
