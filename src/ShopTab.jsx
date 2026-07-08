import { useMemo, useState } from "react";
import { T, won, usd, NumField, Row, Stamp, selectStyle } from "./ui.jsx";
import { CATEGORIES, DUTY_FREE_LIMIT_USD } from "./data/categories.js";
import { calcImportCost } from "./lib/customs.js";

/* 직구 관부가세 계산 탭 */
export default function ShopTab({ jr, ur }) {
  const [price, setPrice] = useState("15000");
  const [localShip, setLocalShip] = useState("0");
  const [intlShip, setIntlShip] = useState("15000");
  const [catId, setCatId] = useState("hobby");

  const shop = useMemo(
    () => calcImportCost({
      priceJpy: parseFloat(price) || 0,
      localShipJpy: parseFloat(localShip) || 0,
      intlShipKrw: parseFloat(intlShip) || 0,
      cat: CATEGORIES.find((c) => c.id === catId),
      jpyKrw: jr,
      usdKrw: ur,
    }),
    [price, localShip, intlShip, catId, jr, ur]
  );

  return (
    <>
      <section style={{ background: T.card, border: `1.5px solid ${T.line}`, borderRadius: 14, padding: "18px 18px 6px", marginBottom: 16 }}>
        <NumField label="상품 가격" suffix="¥" value={price} onChange={setPrice} />
        <NumField label="일본 내 배송비·수수료" suffix="¥" value={localShip} onChange={setLocalShip} hint="면세 판정 기준인 '물품가격'에 포함됩니다" />
        <NumField label="국제 배송비 (배대지·특송)" suffix="₩" value={intlShip} onChange={setIntlShip} hint="면세 판정에는 빠지지만, 과세 시 과세가격에 포함됩니다" />
        <label style={{ display: "block", marginBottom: 14 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.indigo, marginBottom: 5 }}>품목</span>
          <select value={catId} onChange={(e) => setCatId(e.target.value)} style={selectStyle}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} — 관세 {Math.round(c.duty * 100)}%
              </option>
            ))}
          </select>
          {shop.cat.note && (
            <span style={{ display: "block", fontSize: 12, color: shop.cat.excluded ? T.red : T.muted, marginTop: 6, lineHeight: 1.5 }}>
              {shop.cat.note}
            </span>
          )}
        </label>
      </section>

      <section style={{ background: T.card, border: `1.5px solid ${shop.taxed ? T.red : T.green}`, borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 10 }}>
          <Stamp taxed={shop.taxed} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 2 }}>물품가격 (면세 판정 기준)</div>
            <div style={{ fontSize: 19, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {won(shop.goodsKrw)}{" "}
              <span style={{ fontSize: 13.5, color: shop.overLimit ? T.red : T.green, fontWeight: 700 }}>
                ≈ {usd(shop.goodsUsd)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 1.5 }}>
              {shop.taxed
                ? shop.overLimit
                  ? `미화 ${DUTY_FREE_LIMIT_USD}달러 초과 — 초과분이 아닌 전체 금액에 과세됩니다.`
                  : "목록통관 배제 품목 — 금액과 무관하게 과세될 수 있습니다."
                : `미화 ${DUTY_FREE_LIMIT_USD}달러 이하 자가사용 — 관세·부가세가 면제됩니다.`}
            </div>
          </div>
        </div>

        <div style={{ borderTop: `1px dashed ${T.line}`, paddingTop: 8 }}>
          {shop.taxed && (
            <>
              <Row label="과세가격 (물품 + 국제운임)" value={won(shop.taxable)} />
              <Row label={`관세 (${Math.round(shop.cat.duty * 100)}%)`} value={won(shop.duty)} />
              {shop.sct > 0 && <Row label="개별소비세 (200만원 초과분 20%)" value={won(shop.sct)} />}
              {shop.edu > 0 && <Row label="교육세 (개소세의 30%)" value={won(shop.edu)} />}
              <Row label={shop.cat.vatExempt ? "부가가치세 (면제)" : "부가가치세 (10%)"} value={won(shop.vat)} />
              <Row label="세금 합계" value={won(shop.totalTax)} strong red top />
            </>
          )}
          <Row label="최종 예상 비용 (상품+배송+세금)" value={won(shop.final)} strong top={!shop.taxed} />
        </div>
      </section>

      <p style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.7, marginTop: 14 }}>
        · 같은 판매자에게 같은 날 주문한 물품은 합산 과세될 수 있습니다.<br />
        · 실제 세액은 통관 시점의 관세청 고시환율과 세관 판단에 따라 달라집니다. 정확한 금액은 관세청{" "}
        <a href="https://www.customs.go.kr/kcs/ad/tax/BuyTaxCalculation.do" target="_blank" rel="noreferrer" style={{ color: T.indigo, fontWeight: 700 }}>
          해외직구물품 예상세액 조회
        </a>
        에서 확인하세요.
      </p>
    </>
  );
}
