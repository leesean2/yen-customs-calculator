import { useMemo, useState } from "react";
import { T, won, usd, money, rateText, NumField, SelectField, CheckField, Row, Stamp, panel } from "./ui.jsx";
import {
  TRAVELER_LIMIT_USD, TRAVEL_RATES, LIQUOR_TYPES,
  ALCOHOL_ALLOWANCE, TOBACCO_LIMIT_CIGARETTES, PERFUME_LIMIT_ML,
} from "./data/categories.js";
import { calcTravelTax, calcAlcoholTax } from "./lib/customs.js";
import useOriginCountry from "./hooks/useOriginCountry.js";
import OriginSelectField from "./OriginSelect.jsx";
import CalcBreakdown from "./CalcBreakdown.jsx";

/* 여행자 휴대품 세금 계산 탭 (품목별 간이세율 + 술·담배·향수 별도 면세한도)
   여행국 선택: 면세한도($800)는 어느 나라든 같지만, 구매 금액은 현지 통화로
   입력하므로 통화·환율만 출발국 레지스트리를 따른다 (직구 탭과 같은 훅) */
export default function TravelTab({ jr, ur, krwPer }) {
  const [countryId, setCountryId] = useState("JP");
  const [travelTotal, setTravelTotal] = useState("150000");
  const [selfReport, setSelfReport] = useState(true);
  const [rateId, setRateId] = useState("single20");

  const origin = useOriginCountry({ countryId, jr, ur, krwPer });
  const { country, rate: or } = origin;

  // ── 별도 면세 품목 — 기본 $800 한도와 별개로 판정한다 ──
  const [alcBottles, setAlcBottles] = useState("0");
  const [alcLiters, setAlcLiters] = useState("0");
  const [alcPrice, setAlcPrice] = useState("0");
  const [alcTypeId, setAlcTypeId] = useState("spirits");
  const [cigarettes, setCigarettes] = useState("0");
  const [perfumeMl, setPerfumeMl] = useState("0");

  // totalJpy/priceJpy는 '출발국 통화' 금액 (계산식은 통화 중립 — 엔이 기본이라 이름 유지)
  const travel = useMemo(
    () => calcTravelTax({
      totalJpy: parseFloat(travelTotal) || 0,
      jpyKrw: or,
      usdKrw: ur,
      rate: TRAVEL_RATES.find((r) => r.id === rateId),
      selfReport,
    }),
    [travelTotal, selfReport, rateId, or, ur]
  );

  const alcohol = useMemo(
    () => calcAlcoholTax({
      bottles: parseFloat(alcBottles) || 0,
      liters: parseFloat(alcLiters) || 0,
      priceJpy: parseFloat(alcPrice) || 0,
      jpyKrw: or,
      usdKrw: ur,
      type: LIQUOR_TYPES.find((t) => t.id === alcTypeId),
      selfReport,
    }),
    [alcBottles, alcLiters, alcPrice, alcTypeId, or, ur, selfReport]
  );
  const cigCount = parseFloat(cigarettes) || 0;
  const perfume = parseFloat(perfumeMl) || 0;
  const cigOver = cigCount > TOBACCO_LIMIT_CIGARETTES;
  const perfumeOver = perfume > PERFUME_LIMIT_ML;

  return (
    <>
      <section style={{ ...panel(), padding: "18px 18px 6px", marginBottom: 16 }}>
        <OriginSelectField value={countryId} onChange={setCountryId} origin={origin} label="여행국" showLimit={false} />
        <NumField label={`${country.short}에서 구매한 총 금액`} suffix={country.symbol} value={travelTotal} onChange={setTravelTotal} hint="면세점 구매 포함, 국내 반입 물품 전체 — 술·담배·향수는 별도 한도라 여기서 빼고 아래 섹션에 입력하세요" />
        <SelectField
          label="주요 품목 (간이세율)"
          value={rateId}
          onChange={setRateId}
          note={
            <>
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
            </>
          }
        >
          {TRAVEL_RATES.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </SelectField>
        <CheckField label="세관에 자진신고 (세액 30% 감면, 최대 20만원)" checked={selfReport} onChange={setSelfReport} />
      </section>

      <section style={{ ...panel(travel.taxed ? T.red : T.green), padding: 18 }}>
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
                주류는 아래 &lsquo;별도 면세 품목&rsquo; 섹션에서 주종별 세액을 계산할 수 있습니다.
                담배는 담배소비세 등 별도 세율이 적용되어 관세청{" "}
                <a href="https://www.customs.go.kr/kcs/ad/tax/ItemTaxCalculation.do" target="_blank" rel="noreferrer" style={{ color: T.indigo, fontWeight: 700 }}>휴대품 예상세액 조회</a>를 이용하세요.
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
              expr: `${money(parseFloat(travelTotal) || 0, country)} × ${rateText(or, country)} = ${won(travel.totalKrw)}`,
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

      {/* 별도 면세 품목 — 기본 $800 한도와 별개(술·담배·향수) */}
      <section style={{ ...panel(alcohol.taxed || cigOver || perfumeOver ? T.red : T.line), padding: "18px 18px 10px", marginTop: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>🍶 별도 면세 품목 (술·담배·향수)</div>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
          기본 면세한도 ${TRAVELER_LIMIT_USD}와 <b>별도</b>로 적용됩니다 — 술은 {ALCOHOL_ALLOWANCE.bottles}병·
          {ALCOHOL_ALLOWANCE.liters}L·${ALCOHOL_ALLOWANCE.usd} 세 조건을 모두 충족해야 면세입니다.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <NumField label="술 병수" suffix="병" value={alcBottles} onChange={setAlcBottles} />
          <NumField label="술 총 용량" suffix="L" value={alcLiters} onChange={setAlcLiters} />
          <NumField label="술 총 금액" suffix={country.symbol} value={alcPrice} onChange={setAlcPrice} />
        </div>
        <SelectField
          label="주종 (관세·주세율)"
          value={alcTypeId}
          onChange={setAlcTypeId}
          note={
            <span style={{ display: "block", fontSize: 12, marginTop: 6, lineHeight: 1.5, color: alcohol.taxed ? T.red : T.muted, fontWeight: alcohol.taxed ? 700 : 500 }}>
              {alcohol.taxed
                ? `면세 범위 초과(${alcohol.overReasons.join(" · ")}) — 초과분이 아닌 술 전체 금액(${won(alcohol.priceKrw)} ≈ ${usd(alcohol.priceUsd)})이 과세됩니다.`
                : alcohol.entered
                  ? `면세 범위 이내 — 기본 $${TRAVELER_LIMIT_USD} 한도에도 포함되지 않습니다.`
                  : "반입할 술이 있으면 위에 입력하세요. 세 조건 중 하나라도 넘으면 전체가 과세됩니다."}
            </span>
          }
        >
          {LIQUOR_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </SelectField>

        {alcohol.taxed && (
          <div style={{ borderTop: `1px dashed ${T.line}`, paddingTop: 8, marginBottom: 14 }}>
            <Row label={`관세 (${Math.round(alcohol.type.duty * 100)}%)`} value={won(alcohol.duty)} />
            <Row
              label={alcohol.type.liquorPerLiter
                ? `주세 (종량 ${alcohol.type.liquorPerLiter.toLocaleString("ko-KR")}원/L)`
                : `주세 (${Math.round(alcohol.type.liquorRate * 100)}%)`}
              value={won(alcohol.liquor)}
            />
            <Row label={`교육세 (주세의 ${Math.round(alcohol.type.eduRate * 100)}%)`} value={won(alcohol.edu)} />
            <Row label="부가가치세 (10%)" value={won(alcohol.vat)} />
            {alcohol.discount > 0 && <Row label="자진신고 감면 (관세의 30%)" value={"−" + won(alcohol.discount)} />}
            <Row label="술 납부 예상 세액" value={won(alcohol.finalTax)} strong red top />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <NumField label="담배 (궐련)" suffix="개비" value={cigarettes} onChange={setCigarettes} />
            <span style={{ display: "block", fontSize: 11.5, marginTop: -8, marginBottom: 10, lineHeight: 1.5, color: cigOver ? T.red : T.muted, fontWeight: cigOver ? 700 : 500 }}>
              {cigOver
                ? `${TOBACCO_LIMIT_CIGARETTES}개비 초과 — 초과분은 담배소비세 등 별도 세율로 과세되니 세관에 신고하세요.`
                : `${TOBACCO_LIMIT_CIGARETTES}개비까지 면세`}
            </span>
          </div>
          <div>
            <NumField label="향수 용량" suffix="mL" value={perfumeMl} onChange={setPerfumeMl} />
            <span style={{ display: "block", fontSize: 11.5, marginTop: -8, marginBottom: 10, lineHeight: 1.5, color: perfumeOver ? T.red : T.muted, fontWeight: perfumeOver ? 700 : 500 }}>
              {perfumeOver
                ? `${PERFUME_LIMIT_ML}mL 초과 — 향수 전체가 과세 대상이 되니 세관에 신고하세요.`
                : `${PERFUME_LIMIT_ML}mL까지 면세`}
            </span>
          </div>
        </div>
      </section>

      <p style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.7, marginTop: 14 }}>
        · 간이세율은 관세법 시행령 별표2 기준이며, 여러 품목 혼합 구매 시 실제 세액은 품목별 계산에 따라 달라집니다.<br />
        · 주류 세액은 주종별 대표 세율(관세·주세·교육세·부가세)로 계산한 참고값입니다. 자진신고 감면은 세목이 분리된 주류의 경우 관세분에만 적용됩니다.<br />
        · 신고 대상을 신고하지 않고 적발되면 세액의 40%(반복 시 60%) 가산세가 부과됩니다.
      </p>
    </>
  );
}
