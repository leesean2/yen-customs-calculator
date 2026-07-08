import { useMemo, useState } from "react";
import { T, won, usd, yen, NumField, Row, Stamp, selectStyle } from "./ui.jsx";
import { TRAVELER_LIMIT_USD, TRAVEL_RATES } from "./data/categories.js";
import CalcBreakdown, { rate100Text } from "./CalcBreakdown.jsx";

/* 여행자 휴대품 세금 계산 탭 (품목별 간이세율) */
export default function TravelTab({ jr, ur }) {
  const [travelTotal, setTravelTotal] = useState("150000");
  const [selfReport, setSelfReport] = useState(true);
  const [rateId, setRateId] = useState("single20");

  const travel = useMemo(() => {
    const rate = TRAVEL_RATES.find((r) => r.id === rateId);
    const totalKrw = (parseFloat(travelTotal) || 0) * jr;
    const totalUsd = ur ? totalKrw / ur : NaN;
    const limitKrw = TRAVELER_LIMIT_USD * ur;
    const over = Math.max(0, totalKrw - limitKrw);
    const overUsd = ur ? over / ur : NaN;
    const taxed = ur ? over > 0 : false;
    const special = !rate.calc; // 주류·담배 — 간이세율 미적용
    // 단일간이세율(20%)은 과세대상 합계 USD 1,000 이하일 때만 선택 가능
    const singleLimitOver = rate.id === "single20" && overUsd > 1000;
    const tax = taxed && rate.calc ? rate.calc(over) : 0;
    const discount = taxed && !special && selfReport ? Math.min(tax * 0.3, 200_000) : 0;
    return { rate, totalKrw, totalUsd, limitKrw, over, overUsd, taxed, special, singleLimitOver, tax, discount, finalTax: tax - discount };
  }, [travelTotal, selfReport, rateId, jr, ur]);

  return (
    <>
      <section style={{ background: T.card, border: `1.5px solid ${T.line}`, borderRadius: 14, padding: "18px 18px 6px", marginBottom: 16 }}>
        <NumField label="일본에서 구매한 총 금액" suffix="¥" value={travelTotal} onChange={setTravelTotal} hint="면세점 구매 포함, 국내 반입하는 물품 전체" />
        <label style={{ display: "block", marginBottom: 14 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.indigo, marginBottom: 5 }}>주요 품목 (간이세율)</span>
          <select value={rateId} onChange={(e) => setRateId(e.target.value)} style={selectStyle}>
            {TRAVEL_RATES.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
          {travel.rate.note && (
            <span style={{ display: "block", fontSize: 12, color: travel.special ? T.red : T.muted, marginTop: 6, lineHeight: 1.5 }}>
              {travel.rate.note}
            </span>
          )}
          {travel.singleLimitOver && (
            <span style={{ display: "block", fontSize: 12, color: T.red, marginTop: 6, lineHeight: 1.5 }}>
              과세대상이 미화 1,000달러(약 {won(1000 * ur)})를 초과해 단일간이세율(20%)을 적용할 수 없습니다. 위에서 실제 품목을 선택하세요.
            </span>
          )}
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={selfReport} onChange={(e) => setSelfReport(e.target.checked)} style={{ width: 18, height: 18, accentColor: T.indigo }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>세관에 자진신고 (세액 30% 감면, 최대 20만원)</span>
        </label>
      </section>

      <section style={{ background: T.card, border: `1.5px solid ${travel.taxed ? T.red : T.green}`, borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 10 }}>
          <Stamp taxed={travel.taxed} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 2 }}>총 구매금액</div>
            <div style={{ fontSize: 19, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {won(travel.totalKrw)}{" "}
              <span style={{ fontSize: 13.5, color: travel.taxed ? T.red : T.green, fontWeight: 700 }}>
                ≈ {usd(travel.totalUsd)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 1.5 }}>
              여행자 휴대품 기본 면세한도는 미화 <b>{TRAVELER_LIMIT_USD}달러</b>
              {ur ? ` (약 ${won(travel.limitKrw)})` : ""}입니다.
            </div>
          </div>
        </div>

        <div style={{ borderTop: `1px dashed ${T.line}`, paddingTop: 8 }}>
          {travel.taxed ? (
            travel.special ? (
              <p style={{ margin: "6px 0 2px", fontSize: 13, color: T.red, fontWeight: 600, lineHeight: 1.6 }}>
                주류·담배는 간이세율이 아닌 주세·담배소비세 등 별도 세율이 적용되어 여기서 계산할 수 없습니다.
                관세청 <a href="https://www.customs.go.kr/kcs/ad/tax/ItemTaxCalculation.do" target="_blank" rel="noreferrer" style={{ color: T.indigo, fontWeight: 700 }}>휴대품 예상세액 조회</a>를 이용하세요.
              </p>
            ) : (
              <>
                <Row label="면세한도 초과분" value={won(travel.over)} />
                <Row label={`예상 세액 (간이세율 ${travel.rate.rateText})`} value={won(travel.tax)} />
                {travel.discount > 0 && <Row label="자진신고 감면 (−30%)" value={"−" + won(travel.discount)} />}
                <Row label="납부 예상 세액" value={won(travel.finalTax)} strong red top />
              </>
            )
          ) : (
            <Row label="납부 예상 세액" value="0원" strong top />
          )}
        </div>

        <CalcBreakdown
          steps={[
            {
              label: "원화 환산",
              expr: `${yen(parseFloat(travelTotal) || 0)} × ${rate100Text(jr)} = ${won(travel.totalKrw)}`,
            },
            ur > 0 && {
              label: "면세한도 환산",
              expr: `$${TRAVELER_LIMIT_USD} × ${won(ur)}/$1 = ${won(travel.limitKrw)}`,
            },
            {
              label: "면세 판정",
              expr: travel.taxed
                ? `${won(travel.totalKrw)} − 면세한도 ${won(travel.limitKrw)} = 초과분 ${won(travel.over)} → 과세`
                : `${won(travel.totalKrw)} ≤ 면세한도 ${won(travel.limitKrw)} → 면세 (세금 0원)`,
              note: travel.taxed ? "직구와 달리 여행자 휴대품은 한도 초과분에만 과세됩니다." : undefined,
            },
            ...(travel.taxed && !travel.special
              ? [
                  {
                    label: `예상 세액 (간이세율 ${travel.rate.rateText})`,
                    expr: travel.rate.id.endsWith("45")
                      ? `초과분 ${won(travel.over)}에 ${travel.rate.rateText} 구간세율 적용 = ${won(travel.tax)}`
                      : `초과분 ${won(travel.over)} × ${travel.rate.rateText} = ${won(travel.tax)}`,
                    note: travel.rate.note,
                  },
                  travel.discount > 0 && {
                    label: "자진신고 감면",
                    expr: `min(세액 ${won(travel.tax)} × 30%, 상한 200,000원) = −${won(travel.discount)}`,
                  },
                  {
                    label: "납부 예상 세액",
                    expr: `${won(travel.tax)} − 감면 ${won(travel.discount)} = ${won(travel.finalTax)}`,
                  },
                ]
              : []),
          ]}
        />
      </section>

      <p style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.7, marginTop: 14 }}>
        · 간이세율은 관세법 시행령 별표2 기준이며, 여러 품목 혼합 구매 시 실제 세액은 품목별 계산에 따라 달라집니다.<br />
        · 술(2병·2L·$400 이내)·담배(궐련 200개비)·향수(100mL)는 기본 면세한도와 별도로 적용됩니다.<br />
        · 신고 대상을 신고하지 않고 적발되면 세액의 40%(반복 시 60%) 가산세가 부과됩니다.
      </p>
    </>
  );
}
