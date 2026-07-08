import { useMemo, useState } from "react";
import { T, won, usd, yen, NumField, TextField, Row, Stamp, selectStyle } from "./ui.jsx";
import { CATEGORIES, DUTY_FREE_LIMIT_USD } from "./data/categories.js";
import { calcImportCost } from "./lib/customs.js";
import { loadOrders, saveOrders, newOrderId, todayStr } from "./lib/orders.js";

/* 직구 관부가세 계산 탭 (+ 구매 이력 · 합산과세 추적) */
export default function ShopTab({ jr, ur }) {
  const [price, setPrice] = useState("15000");
  const [localShip, setLocalShip] = useState("0");
  const [intlShip, setIntlShip] = useState("15000");
  const [catId, setCatId] = useState("hobby");

  // ── 구매 이력 (합산과세 추적) ──
  const [seller, setSeller] = useState("");
  const [itemName, setItemName] = useState("");
  const [orders, setOrders] = useState(loadOrders);
  const [justSaved, setJustSaved] = useState(false);

  const addOrder = (order) => {
    setOrders((prev) => {
      const next = [{ id: newOrderId(), ...order }, ...prev];
      saveOrders(next);
      return next;
    });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  };
  const removeOrder = (id) => {
    setOrders((prev) => {
      const next = prev.filter((o) => o.id !== id);
      saveOrders(next);
      return next;
    });
  };

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

  // 같은 날 + 같은 판매자 기록 → 합산과세 경고
  const sellerTrim = seller.trim();
  const dupes = useMemo(() => {
    if (!sellerTrim) return [];
    const today = todayStr();
    return orders.filter(
      (o) => o.date === today && o.seller.toLowerCase() === sellerTrim.toLowerCase()
    );
  }, [orders, sellerTrim]);
  const dupSumJpy = dupes.reduce((sum, o) => sum + o.goodsJpy, 0);
  // 면세 판정 기준은 '물품가격'(상품가+현지 배송비) — 합산도 같은 기준
  const combinedUsd = ur ? ((dupSumJpy + shop.goodsJpy) * jr) / ur : NaN;
  const combinedOver = combinedUsd > DUTY_FREE_LIMIT_USD;

  const canRecord = sellerTrim && shop.goodsJpy > 0;

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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <TextField label="판매자 (합산과세 추적)" value={seller} onChange={setSeller} placeholder="예: 아마존재팬, ○○스토어" />
          <TextField label="상품명 (선택)" value={itemName} onChange={setItemName} placeholder="기록용 메모" />
        </div>
      </section>

      {/* 합산과세 경고 — 같은 날 같은 판매자 기록이 있을 때 */}
      {dupes.length > 0 && (
        <div style={{
          borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, lineHeight: 1.7, fontWeight: 600,
          background: combinedOver ? T.redSoft : "#FBF4E3",
          color: combinedOver ? T.red : "#8A6914",
          border: `1.5px solid ${combinedOver ? T.red : "#C79A2A"}`,
        }}>
          ⚠️ 오늘 &lsquo;{sellerTrim}&rsquo;에게 주문한 기록 {dupes.length}건(물품가격 {yen(dupSumJpy)})이 있습니다.
          이번 주문과 합산하면 약 <b>{usd(combinedUsd)}</b> —{" "}
          {combinedOver
            ? `같은 날 같은 판매자 주문은 합산 과세될 수 있어, 면세한도(${DUTY_FREE_LIMIT_USD}달러)를 초과해 전체 금액에 세금이 붙을 수 있습니다. 주문일을 나누는 것을 고려하세요.`
            : `아직 면세한도(${DUTY_FREE_LIMIT_USD}달러) 이내지만, 합산 기준으로 관리하세요.`}
        </div>
      )}

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

      {/* 구매 이력 */}
      <section style={{ background: T.card, border: `1.5px solid ${T.line}`, borderRadius: 14, padding: "16px 16px 12px", marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: T.ink }}>
            🧾 구매 이력 <span style={{ fontWeight: 600, color: T.muted, fontSize: 12 }}>({orders.length}건 · 최근 60일)</span>
          </div>
          <button
            onClick={() => addOrder({ date: todayStr(), seller: sellerTrim, item: itemName.trim(), goodsJpy: shop.goodsJpy })}
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
                <button onClick={() => removeOrder(o.id)} aria-label="삭제" style={{
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
