import { useMemo, useState } from "react";
import { T, won, NumField, SelectField, CheckField, Row, panel } from "./ui.jsx";
import { CATEGORIES, TRAVEL_RATES, TRAVELER_LIMIT_USD } from "./data/categories.js";
import { calcImportCost, calcTravelTax } from "./lib/customs.js";
import useOriginCountry from "./hooks/useOriginCountry.js";
import OriginSelectField from "./OriginSelect.jsx";

/* ──────────────────────────────────────────────
   같은 상품 — 직구 vs 여행 반입 비교 탭
   - 직구: 국제배송으로 받는다. 소액면세 한도(출발국별 $150/$200), 초과 시 전체 과세.
   - 여행: 여행 중 사서 직접 들고 온다. 면세한도 USD 800, 초과분에만 과세.
   면세한도가 몇 배씩 차이 나서, 같은 상품도 어느 경로가 유리한지 크게 갈린다.
   (여행은 이미 현지에 가 있다고 가정 — 항공권은 매몰비용으로 보고 계산에서 뺀다)
   ────────────────────────────────────────────── */

/* 인장 스타일 판정 배지 */
function RouteStamp({ verdict }) {
  const conf = {
    travel: { color: T.green, main: "여행 유리", sub: "CARRY BACK" },
    shop: { color: T.red, main: "직구 유리", sub: "SHIP IT" },
    even: { color: T.muted, main: "비슷함", sub: "ABOUT EQUAL" },
  }[verdict];
  return (
    <div style={{
      width: 86, height: 86, borderRadius: "50%",
      border: `3.5px solid ${conf.color}`, color: conf.color,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      transform: "rotate(-8deg)", flexShrink: 0,
      fontWeight: 900, letterSpacing: "0.05em", userSelect: "none",
    }}>
      <span style={{ fontSize: 19, lineHeight: 1 }}>{conf.main}</span>
      <span style={{ fontSize: 8.5, marginTop: 4, fontWeight: 700, letterSpacing: "0.12em" }}>{conf.sub}</span>
    </div>
  );
}

const cardStyle = { ...panel(), padding: "18px 18px 6px", marginBottom: 16 };

export default function RouteCompareTab({ jr, ur, krwPer }) {
  const [countryId, setCountryId] = useState("JP");
  const [price, setPrice] = useState("120000");
  const [intlShip, setIntlShip] = useState("15000");
  const [catId, setCatId] = useState("hobby");
  const [rateId, setRateId] = useState("single20");
  const [selfReport, setSelfReport] = useState(true);

  // 출발국 환율 — 여행도 같은 나라에서 사 온다고 보고 양쪽에 동일 적용
  const origin = useOriginCountry({ countryId, jr, ur, krwPer });
  const { country, rate: or } = origin;

  const priceJpy = parseFloat(price) || 0;

  // 직구: 국제배송 + 관부가세 (소액면세 한도는 출발국별)
  const shop = useMemo(
    () => calcImportCost({
      priceJpy,
      intlShipKrw: parseFloat(intlShip) || 0,
      cat: CATEGORIES.find((c) => c.id === catId),
      jpyKrw: or,
      usdKrw: ur,
      deMinimisUsd: country.deMinimisUsd,
    }),
    [priceJpy, intlShip, catId, or, ur, country]
  );

  // 여행: 직접 반입, 배송비 없음 (면세한도 $800)
  const travel = useMemo(
    () => calcTravelTax({
      totalJpy: priceJpy,
      jpyKrw: or,
      usdKrw: ur,
      rate: TRAVEL_RATES.find((r) => r.id === rateId),
      selfReport,
    }),
    [priceJpy, rateId, selfReport, or, ur]
  );

  const ready = priceJpy > 0 && or > 0 && ur > 0;
  // 주류·담배는 여행자 간이세율로 계산할 수 없어 비교 판정을 보류한다
  const computable = ready && !travel.special;

  const diff = shop.final - travel.final; // 양수면 여행이 저렴
  const base = Math.min(shop.final, travel.final);
  const diffPct = computable && base > 0 ? (Math.abs(diff) / base) * 100 : 0;
  const verdict = !computable ? null : diffPct < 3 ? "even" : diff > 0 ? "travel" : "shop";

  return (
    <>
      {/* 입력 */}
      <section style={cardStyle}>
        <OriginSelectField value={countryId} onChange={setCountryId} origin={origin} />
        <NumField label={`${country.short} 상품 가격`} suffix={country.symbol} value={price} onChange={setPrice}
          hint="현지 세금 포함가. 직구·여행 양쪽에 동일하게 적용됩니다" />
        <NumField label="국제 배송비 (직구 시 · 배대지·특송)" suffix="₩" value={intlShip} onChange={setIntlShip}
          hint="여행 반입에는 붙지 않습니다" />
        <SelectField label="품목 (직구 관세율)" value={catId} onChange={setCatId}>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label} — 관세 {Math.round(c.duty * 100)}%</option>
          ))}
        </SelectField>
        <SelectField label="품목 (여행 간이세율)" value={rateId} onChange={setRateId}>
          {TRAVEL_RATES.map((r) => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </SelectField>
        <CheckField label="여행 시 세관 자진신고 (세액 30% 감면)" checked={selfReport} onChange={setSelfReport} />
      </section>

      {/* 판정 */}
      <section style={{
        ...panel(verdict === "travel" ? T.green : verdict === "shop" ? T.red : T.line),
        padding: 18,
      }}>
        {computable ? (
          <>
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 10 }}>
              <RouteStamp verdict={verdict} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: T.muted, marginBottom: 2 }}>
                  {verdict === "even" ? "두 경로 차이 3% 미만" : verdict === "travel" ? "여행 반입이 더 저렴합니다" : "직구가 더 저렴합니다"}
                </div>
                <div style={{ fontSize: 21, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: verdict === "travel" ? T.green : verdict === "shop" ? T.red : T.ink }}>
                  {won(Math.abs(diff))} <span style={{ fontSize: 13.5 }}>({diffPct.toFixed(1)}%)</span>
                </div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 1.5 }}>
                  {verdict === "even"
                    ? "면세한도 차이가 세금에 큰 영향을 주지 않는 구간입니다."
                    : `면세한도가 직구 $${country.deMinimisUsd} vs 여행 $${TRAVELER_LIMIT_USD}로 달라, 이 상품은 ${verdict === "travel" ? "직접 들고 오는 편" : "배송으로 받는 편"}이 세금·비용에서 유리합니다.`}
                </div>
              </div>
            </div>

            <div style={{ borderTop: `1px dashed ${T.line}`, paddingTop: 8 }}>
              <Row label="🚚 직구 최종가" value={won(shop.final)} strong />
              <Row label={`└ 상품 · 국제배송 · 관부가세${shop.taxed ? ` (${won(shop.totalTax)})` : " 0원(면세)"}`}
                value={won(shop.goodsKrw) + " + " + won(shop.intl)} />
              <Row label="🧳 여행 반입 최종가" value={won(travel.final)} strong top />
              <Row label={`└ 상품 · 여행세${travel.taxed ? ` (${won(travel.finalTax)})` : " 0원(면세)"}`}
                value={won(travel.totalKrw)} />
            </div>

            {travel.singleLimitOver && (
              <p style={{ fontSize: 11.5, color: T.warnInk, background: T.warnBg, border: `1px solid ${T.warnLine}`, borderRadius: 8, padding: "8px 10px", margin: "12px 0 0", lineHeight: 1.6 }}>
                ⚠️ 과세대상이 미화 1,000달러를 초과해 여행 단일간이세율(20%)을 적용할 수 없습니다. 위에서 실제 품목의 간이세율을 선택하면 여행 세액이 정확해집니다.
              </p>
            )}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.7 }}>
            {!ready
              ? <>상품 가격을 입력하면(환율이 준비되면), 같은 물건을 <b>직구로 배송받을 때</b>와 <b>여행 중 직접 들고 올 때</b>의 세금·비용을 비교해 어느 쪽이 유리한지 판정해 드립니다.</>
              : <>주류·담배는 여행자 간이세율이 아닌 별도 세율이 적용되어 여행 반입 비용을 계산할 수 없습니다. 위에서 다른 품목을 선택하세요.</>}
          </p>
        )}
      </section>

      <p style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.7, marginTop: 14 }}>
        · 직구는 소액면세 한도 <b>{country.deMinimisUsd}달러</b>({country.label} 출발 기준)를 넘으면 초과분이 아닌 전체 금액이 과세됩니다.<br />
        · 여행자 휴대품은 한도 <b>{TRAVELER_LIMIT_USD}달러</b>를 넘는 초과분에만 간이세율이 적용됩니다.<br />
        · 여행은 이미 현지에 가 있다고 가정해 항공권·체류비는 계산에 넣지 않았습니다. 이 여행에서 산 다른 물건이 있으면 면세한도가 함께 소진되니 실제로는 더 불리할 수 있습니다.<br />
        · 직구는 배송 기간·반품 난이도를, 여행은 휴대 부피·파손 위험을 함께 고려하세요.
      </p>
    </>
  );
}
