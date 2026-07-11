import { useEffect, useMemo, useRef, useState } from "react";
import { T, won, usd, money, rateText, NumField, TextField, SelectField, Row, Stamp, panel } from "./ui.jsx";
import { CATEGORIES, LUXURY_SCT_BASE } from "./data/categories.js";
import { calcCartImportCost } from "./lib/customs.js";
import { todayStr } from "./lib/orders.js";
import { buildShareUrl } from "./lib/share.js";
import useOrders from "./hooks/useOrders.js";
import useOriginCountry from "./hooks/useOriginCountry.js";
import useCustomsRate from "./hooks/useCustomsRate.js";
import OriginSelectField from "./OriginSelect.jsx";
import HsRateField from "./HsRate.jsx";
import ShipEstimateField from "./ShipEstimate.jsx";
import CategoryOptions from "./CategoryOptions.jsx";
import OrderHistoryCard from "./OrderHistoryCard.jsx";
import SavedCalcsCard from "./SavedCalcsCard.jsx";
import CalcBreakdown from "./CalcBreakdown.jsx";
import ClearanceGuide from "./ClearanceGuide.jsx";

/* 계산 근거 단계별 수식 — 화면 수치와 같은 값(shop.*)을 그대로 대입해 보여준다
   country: 출발국(data/countries.js) · or: 출발국 통화 1단위당 원화 환율
   상품이 여러 개면(장바구니) 관세·개소세·부가세를 품목별 안분 기준으로 풀어 쓴다 */
function buildBreakdownSteps({ shop, country, or, ur, localShip }) {
  const multi = shop.items.length > 1;
  const one = shop.items[0]; // 단일 상품일 때의 품목
  const taxTerms = [
    `관세 ${won(shop.duty)}`,
    shop.sct > 0 && `개소세 ${won(shop.sct)}`,
    shop.edu > 0 && `교육세 ${won(shop.edu)}`,
    `부가세 ${won(shop.vat)}`,
  ].filter(Boolean);

  return [
    {
      label: "물품가격 (면세 판정 기준)",
      expr: `상품${multi ? ` ${shop.items.length}개 합계` : ""} ${money(shop.itemsJpy, country)} + ${country.short} 내 배송·수수료 ${money(parseFloat(localShip) || 0, country)} = ${money(shop.goodsJpy, country)}`,
    },
    {
      label: "원화 환산",
      expr: `${money(shop.goodsJpy, country)} × ${rateText(or, country)} = ${won(shop.goodsKrw)}`,
    },
    ur > 0 && {
      label: "달러 환산",
      expr: `${won(shop.goodsKrw)} ÷ ${won(ur)}/$1 = ${usd(shop.goodsUsd)}`,
    },
    {
      label: "면세 판정",
      expr: shop.hasExcluded
        ? "목록통관 배제 품목 → 금액과 무관하게 과세"
        : shop.overLimit
          ? `${usd(shop.goodsUsd)} > 면세한도 $${country.deMinimisUsd} → 전체 금액 과세`
          : `${usd(shop.goodsUsd)} ≤ 면세한도 $${country.deMinimisUsd} → 면세`,
      note: shop.overLimit ? "한도를 넘으면 초과분이 아닌 물품가격 전체가 과세됩니다." : undefined,
    },
    ...(shop.taxed
      ? [
          {
            label: "과세가격",
            expr: `물품 ${won(shop.goodsKrw)} + 국제운임 ${won(shop.intl)} = ${won(shop.taxable)}`,
          },
          multi
            ? {
                label: "관세 (품목별)",
                expr: `${shop.items.map((it) => `${won(it.base)} × ${Math.round(it.dutyRate * 100)}%`).join(" + ")} = ${won(shop.duty)}`,
                note: "과세가격을 상품가 비율로 안분해 품목별 관세율을 적용합니다.",
              }
            : {
                label: `관세 (${Math.round(one.dutyRate * 100)}%)`,
                expr: `${won(shop.taxable)} × ${Math.round(one.dutyRate * 100)}% = ${won(shop.duty)}`,
              },
          shop.sct > 0 && {
            label: "개별소비세 (20%)",
            expr: multi
              ? `가방·시계 품목별 (과세가격+관세 − 기준 ${won(LUXURY_SCT_BASE)}) × 20% = ${won(shop.sct)}`
              : `(과세가격+관세 ${won(shop.taxable + shop.duty)} − 기준 ${won(LUXURY_SCT_BASE)}) × 20% = ${won(shop.sct)}`,
          },
          shop.edu > 0 && {
            label: "교육세 (개소세의 30%)",
            expr: `${won(shop.sct)} × 30% = ${won(shop.edu)}`,
          },
          multi
            ? {
                label: "부가가치세 (10%)",
                expr: `품목별 (과세가격+관세+개소세) × 10%, 면제 품목(서적류) 제외 = ${won(shop.vat)}`,
              }
            : {
                label: one.cat.vatExempt ? "부가가치세 (면제)" : "부가가치세 (10%)",
                expr: one.cat.vatExempt
                  ? "서적류는 부가가치세가 면제됩니다 → 0원"
                  : `(과세가격 ${won(shop.taxable)} + 관세 ${won(shop.duty)}${shop.sct > 0 ? ` + 개소세 ${won(shop.sct)} + 교육세 ${won(shop.edu)}` : ""}) × 10% = ${won(shop.vat)}`,
              },
          {
            label: "세금 합계",
            expr: `${taxTerms.join(" + ")} = ${won(shop.totalTax)}`,
          },
        ]
      : []),
    {
      label: "최종 예상 비용",
      expr: `물품 ${won(shop.goodsKrw)} + 국제 배송 ${won(shop.intl)} + 세금 ${won(shop.totalTax)} = ${won(shop.final)}`,
    },
  ];
}

/* 직구 관부가세 계산 탭 (+ 구매 이력 · 합산과세 추적)
   shared: 공유 링크(URL 쿼리)로 들어온 입력값 스냅샷 — 첫 렌더에서만 쓴다
   krwPer: useExchangeRates의 통화→원 실시간 맵 (EUR·CNY 출발국 환율에 우선 사용) */
export default function ShopTab({ jr, ur, krwPer, shared }) {
  const [countryId, setCountryId] = useState(shared?.o ?? "JP");
  // ── 장바구니 — 면세 판정은 주문 전체 기준이라 상품을 여러 줄로 합산한다 ──
  // hsRate: HS부호 조회로 적용한 정확 관세율 { hs, rate(%) } | null
  const newItemId = () => Math.random().toString(36).slice(2, 8);
  const [items, setItems] = useState(() =>
    shared?.it?.length
      ? shared.it.map((x) => ({
          id: newItemId(), price: x.p, catId: x.c,
          hsRate: x.hs ? { hs: x.hs, rate: x.d } : null,
        }))
      : [{ id: newItemId(), price: shared?.p ?? "15000", catId: shared?.c ?? "hobby", hsRate: null }]
  );
  const setItem = (id, patch) =>
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const addItem = () => setItems((arr) => [...arr, { id: newItemId(), price: "", catId: "hobby", hsRate: null }]);
  const removeItem = (id) => setItems((arr) => arr.filter((it) => it.id !== id));

  const [localShip, setLocalShip] = useState(shared?.l ?? "0");
  const [intlShip, setIntlShip] = useState(shared?.i ?? "15000");

  // ── 구매 이력 (합산과세 추적) ──
  const [seller, setSeller] = useState("");
  const [itemName, setItemName] = useState("");

  // ── 출발국 환율(or) — 해석 우선순위는 useOriginCountry 참고 ──
  // 공유 링크의 r(원/1단위)은 발신 시점 스냅샷 — 사용자가 출발국을 바꾸는 순간 폐기해,
  // 되돌아와도 실시간 조회로 넘어간다. r이 0·음수·비수치면 스냅샷 없이 실시간 조회.
  const [sharedOrigin, setSharedOrigin] = useState(() => {
    const rate = parseFloat(shared?.r);
    return shared?.o && rate > 0 ? { id: shared.o, rate } : null;
  });
  const changeCountry = (id) => {
    if (sharedOrigin && id !== sharedOrigin.id) setSharedOrigin(null);
    setCountryId(id);
  };
  const origin = useOriginCountry({
    countryId, jr, ur, krwPer,
    override: sharedOrigin?.id === countryId ? sharedOrigin.rate : null,
  });
  const { country, isAppCurrency, rate: or } = origin;

  const shop = useMemo(
    () => calcCartImportCost({
      items: items.map((it) => ({
        priceJpy: parseFloat(it.price) || 0,
        cat: CATEGORIES.find((c) => c.id === it.catId),
        dutyRate: it.hsRate ? it.hsRate.rate / 100 : undefined,
      })),
      localShipJpy: parseFloat(localShip) || 0,
      intlShipKrw: parseFloat(intlShip) || 0,
      jpyKrw: or,
      usdKrw: ur,
      deMinimisUsd: country.deMinimisUsd,
    }),
    [items, localShip, intlShip, or, ur, country]
  );

  // 같은 날 + 같은 판매자 기록 → 합산과세 경고
  // 면세 판정 기준은 '물품가격'(상품가+현지 배송비) — 합산도 같은 기준
  const { orders, add, remove, importOrders, sellerTrim, dupes, dupSumJpy, combinedUsd, combinedOver } =
    useOrders({ seller, goodsJpy: shop.goodsJpy, jpyKrw: or, usdKrw: ur, limitUsd: country.deMinimisUsd, country: countryId });

  const canRecord = sellerTrim && shop.goodsJpy > 0;
  const breakdownSteps = buildBreakdownSteps({ shop, country, or, ur, localShip });

  // ── 관세청 과세환율(주간 고시) — 실제 세액 산정 기준이라 시장 환율과 병기한다 ──
  // 과세환율로 환산한 달러 금액이 면세 판정을 뒤집으면(경계 근처) 경고를 띄운다
  const customs = useCustomsRate();
  const customsRate = customs?.rates?.[country.currency];
  const customsGoodsKrw = customsRate ? shop.goodsJpy * customsRate : null;
  const customsGoodsUsd =
    customsGoodsKrw != null && customs.rates.USD ? customsGoodsKrw / customs.rates.USD : null;
  const customsMismatch =
    customsGoodsUsd != null && !shop.hasExcluded &&
    (customsGoodsUsd > country.deMinimisUsd) !== shop.overLimit;

  // 입력값+환율 스냅샷 URL — 결과 링크 공유와 계산 저장함이 같은 스냅샷을 쓴다
  const makeShareUrl = () =>
    buildShareUrl({
      items, localShip, intlShip, countryId, jr, ur,
      originRate: isAppCurrency ? null : or,
    });

  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  const copyShareLink = async () => {
    const url = makeShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      // 클립보드 API가 막힌 환경(비보안 컨텍스트 등) — 직접 복사하게 보여준다
      window.prompt("아래 링크를 복사하세요", url);
    }
  };

  return (
    <>
      <section style={{ ...panel(), padding: "18px 18px 6px", marginBottom: 16 }}>
        <OriginSelectField value={countryId} onChange={changeCountry} origin={origin} />
        {items.map((it, i) => {
          const cat = CATEGORIES.find((c) => c.id === it.catId);
          return (
            <div key={it.id} style={i > 0 ? { borderTop: `1px dashed ${T.line}`, paddingTop: 10 } : undefined}>
              {items.length > 1 && (
                <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: T.muted }}>상품 {i + 1}</span>
                  <button aria-label={`상품 ${i + 1} 삭제`} onClick={() => removeItem(it.id)} style={{
                    border: "none", background: "transparent", color: T.red, cursor: "pointer",
                    fontSize: 11.5, fontWeight: 700, padding: 0,
                  }}>
                    × 삭제
                  </button>
                </div>
              )}
              <NumField
                label={i === 0 ? "상품 가격" : `상품 ${i + 1} 가격`}
                suffix={country.symbol} value={it.price}
                onChange={(v) => setItem(it.id, { price: v })}
              />
              <SelectField
                label={i === 0 ? "품목" : `상품 ${i + 1} 품목`}
                value={it.catId}
                onChange={(v) => setItem(it.id, { catId: v })}
                note={cat.note && (
                  <span style={{ display: "block", fontSize: 12, color: cat.excluded ? T.red : T.muted, marginTop: 6, lineHeight: 1.5 }}>
                    {cat.note}
                  </span>
                )}
              >
                <CategoryOptions />
              </SelectField>
              <HsRateField
                applied={it.hsRate}
                onApply={(hsRate) => setItem(it.id, { hsRate })}
                onClear={() => setItem(it.id, { hsRate: null })}
              />
            </div>
          );
        })}
        <button onClick={addItem} style={{
          border: `1px dashed ${T.indigo}`, background: "transparent", color: T.indigo,
          borderRadius: 10, padding: "8px 14px", fontSize: 12.5, fontWeight: 700,
          cursor: "pointer", width: "100%", marginBottom: 14,
        }}>
          ＋ 상품 추가 — 같은 주문의 상품은 합산해서 면세 판정됩니다
        </button>
        <NumField label={`${country.short} 내 배송비·수수료`} suffix={country.symbol} value={localShip} onChange={setLocalShip} hint="면세 판정 기준인 '물품가격'에 포함됩니다" />
        <NumField label="국제 배송비 (배대지·특송)" suffix="₩" value={intlShip} onChange={setIntlShip} hint="면세 판정에는 빠지지만, 과세 시 과세가격에 포함됩니다" />
        <ShipEstimateField countryId={countryId} onApply={setIntlShip} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <TextField label="판매자 (합산과세 추적)" value={seller} onChange={setSeller} placeholder="예: 아마존재팬, ○○스토어" />
          <TextField label="상품명 (선택)" value={itemName} onChange={setItemName} placeholder="기록용 메모" />
        </div>
      </section>

      {/* 합산과세 경고 — 같은 날 같은 판매자 기록이 있을 때 */}
      {dupes.length > 0 && (
        <div style={{
          borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, lineHeight: 1.7, fontWeight: 600,
          background: combinedOver ? T.redSoft : T.warnBg,
          color: combinedOver ? T.red : T.warnInk,
          border: `1.5px solid ${combinedOver ? T.red : T.warnLine}`,
        }}>
          ⚠️ 오늘 &lsquo;{sellerTrim}&rsquo;에게 주문한 기록 {dupes.length}건(물품가격 {money(dupSumJpy, country)})이 있습니다.
          이번 주문과 합산하면 약 <b>{usd(combinedUsd)}</b> —{" "}
          {combinedOver
            ? `같은 날 같은 판매자 주문은 합산 과세될 수 있어, 면세한도(${country.deMinimisUsd}달러)를 초과해 전체 금액에 세금이 붙을 수 있습니다. 주문일을 나누는 것을 고려하세요.`
            : `아직 면세한도(${country.deMinimisUsd}달러) 이내지만, 합산 기준으로 관리하세요.`}
        </div>
      )}

      <section style={{ ...panel(shop.taxed ? T.red : T.green), padding: 18 }}>
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
                  ? `미화 ${country.deMinimisUsd}달러 초과 — 초과분이 아닌 전체 금액에 과세됩니다.`
                  : "목록통관 배제 품목 — 금액과 무관하게 과세될 수 있습니다."
                : `미화 ${country.deMinimisUsd}달러 이하 자가사용 — 관세·부가세가 면제됩니다.`}
            </div>
            {customsGoodsUsd != null && (
              <div style={{ fontSize: 11.5, color: customsMismatch ? T.red : T.muted, marginTop: 3, lineHeight: 1.5, fontWeight: customsMismatch ? 700 : 500 }}>
                과세환율 기준 ≈ {won(customsGoodsKrw)} · {usd(customsGoodsUsd)}
                {customs.appliedFrom && ` (관세청 주간 고시 · ${customs.appliedFrom}~)`}
                {customsMismatch &&
                  " — 세관은 과세환율로 계산하므로 실제 면세 판정이 여기 결과와 다를 수 있습니다!"}
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop: `1px dashed ${T.line}`, paddingTop: 8 }}>
          {shop.taxed && (
            <>
              <Row label="과세가격 (물품 + 국제운임)" value={won(shop.taxable)} />
              <Row
                label={shop.items.length > 1 ? "관세 (품목별 합산)" : `관세 (${Math.round(shop.items[0].dutyRate * 100)}%)`}
                value={won(shop.duty)}
              />
              {shop.sct > 0 && <Row label="개별소비세 (200만원 초과분 20%)" value={won(shop.sct)} />}
              {shop.edu > 0 && <Row label="교육세 (개소세의 30%)" value={won(shop.edu)} />}
              <Row
                label={shop.items.length === 1 && shop.items[0].cat.vatExempt ? "부가가치세 (면제)" : "부가가치세 (10%)"}
                value={won(shop.vat)}
              />
              <Row label="세금 합계" value={won(shop.totalTax)} strong red top />
            </>
          )}
          <Row label="최종 예상 비용 (상품+배송+세금)" value={won(shop.final)} strong top={!shop.taxed} />
        </div>

        <CalcBreakdown steps={breakdownSteps} />

        <ClearanceGuide shop={shop} country={country} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          <button onClick={copyShareLink} style={{
            border: `1px solid ${T.indigo}`, background: copied ? T.indigo : "transparent",
            color: copied ? "#fff" : T.indigo, borderRadius: 8, padding: "7px 14px",
            fontSize: 12.5, fontWeight: 700, cursor: "pointer", transition: "background .15s, color .15s",
          }}>
            {copied ? "✓ 링크 복사됨" : "🔗 이 계산 결과 링크 복사"}
          </button>
          <span style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
            입력값과 환율이 담겨, 받는 사람이 같은 계산을 그대로 봅니다
          </span>
        </div>
      </section>

      <SavedCalcsCard
        makeSnapshot={() => ({
          // 공유 링크와 같은 스냅샷 — 저장함은 그 쿼리 부분만 보관한다
          query: new URL(makeShareUrl()).search,
          summary: `${country.flag} ${money(shop.goodsJpy, country)}${shop.taxed ? ` · 세금 ${won(shop.totalTax)}` : ""} · 최종 ${won(shop.final)}`,
        })}
      />

      <OrderHistoryCard
        orders={orders}
        canRecord={canRecord}
        onRecord={() => add({
          date: todayStr(),
          seller: sellerTrim,
          item: itemName.trim(),
          country: countryId,
          goodsJpy: shop.goodsJpy,
          // 월간 지출 요약용 — 기록 시점 환율로 계산된 예상 세금·최종 비용(원)
          taxKrw: Math.round(shop.totalTax),
          finalKrw: Math.round(shop.final),
        })}
        onRemove={remove}
        onImport={importOrders}
      />


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
