import { useEffect, useMemo, useState } from "react";
import useExchangeRates from "./hooks/useExchangeRates.js";
import {
  CATEGORIES,
  DUTY_FREE_LIMIT_USD,
  TRAVELER_LIMIT_USD,
} from "./data/categories.js";
import { T, won, usd, NumField, Row } from "./ui.jsx";
import { calcImportCost } from "./lib/customs.js";
import CompareTab from "./CompareTab.jsx";

/* ──────────────────────────────────────────────
   엔화 직구 · 여행 관부가세 계산기 (실시간 환율)
   기준: 2026-07 관세청 규정 (참고용 계산)
   ────────────────────────────────────────────── */

/* 인장(도장) 스타일 판정 표시 */
function Stamp({ taxed }) {
  const color = taxed ? T.red : T.green;
  return (
    <div aria-label={taxed ? "과세 대상" : "면세 대상"} style={{
      width: 86, height: 86, borderRadius: "50%",
      border: `3.5px solid ${color}`, color,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      transform: "rotate(-8deg)", flexShrink: 0,
      boxShadow: `inset 0 0 0 2px ${taxed ? T.redSoft : T.greenSoft}`,
      fontWeight: 900, letterSpacing: "0.1em", userSelect: "none",
    }}>
      <span style={{ fontSize: 26, lineHeight: 1 }}>{taxed ? "과세" : "면세"}</span>
      <span style={{ fontSize: 9.5, marginTop: 4, fontWeight: 700, letterSpacing: "0.15em" }}>
        {taxed ? "TAXABLE" : "DUTY FREE"}
      </span>
    </div>
  );
}

/* 환율 상태 배지 */
function RateBadge({ status, source, fetchedAt, overridden, onRefresh, onReset }) {
  const dot = {
    live: T.green,
    cached: "#C79A2A",
    loading: T.muted,
    error: T.red,
  }[status];
  const text = overridden
    ? "직접 입력한 환율 사용 중"
    : {
        live: `실시간 환율 · ${source ?? ""}`,
        cached: "저장된 환율 사용 중 (갱신 실패)",
        loading: "환율 불러오는 중…",
        error: "환율을 불러오지 못했습니다 — 직접 입력해 주세요",
      }[status];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minHeight: 24 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      <span style={{ fontSize: 11.5, color: T.muted, fontWeight: 600 }}>
        {text}
        {!overridden && fetchedAt && status !== "loading" && (
          <> · {new Date(fetchedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준</>
        )}
      </span>
      <span style={{ flex: 1 }} />
      {overridden ? (
        <button onClick={onReset} style={badgeBtnStyle}>실시간 환율로 되돌리기</button>
      ) : (
        <button onClick={onRefresh} disabled={status === "loading"} style={badgeBtnStyle}>
          새로고침
        </button>
      )}
    </div>
  );
}

const badgeBtnStyle = {
  border: `1px solid ${T.indigo}`,
  background: "transparent",
  color: T.indigo,
  borderRadius: 7,
  padding: "4px 10px",
  fontSize: 11.5,
  fontWeight: 700,
  cursor: "pointer",
};

export default function App() {
  const [tab, setTab] = useState("shop");

  // ── 환율: API 값 ↔ 수동 입력 ──
  const { rates, status, fetchedAt, refresh } = useExchangeRates();
  const [jpyRate, setJpyRate] = useState("");
  const [usdRate, setUsdRate] = useState("");
  const [overridden, setOverridden] = useState(false);

  // API 값 도착 시, 사용자가 수동 수정하지 않았다면 자동 반영
  useEffect(() => {
    if (rates && !overridden) {
      setJpyRate(rates.jpyKrw.toFixed(2));
      setUsdRate(rates.usdKrw.toFixed(0));
    }
  }, [rates, overridden]);

  const editRate = (setter) => (v) => {
    setOverridden(true);
    setter(v);
  };
  const resetToLive = () => {
    setOverridden(false);
    if (rates) {
      setJpyRate(rates.jpyKrw.toFixed(2));
      setUsdRate(rates.usdKrw.toFixed(0));
    } else {
      refresh();
    }
  };

  // ── 직구 입력 ──
  const [price, setPrice] = useState("15000");
  const [localShip, setLocalShip] = useState("0");
  const [intlShip, setIntlShip] = useState("15000");
  const [catId, setCatId] = useState("hobby");

  // ── 여행 입력 ──
  const [travelTotal, setTravelTotal] = useState("150000");
  const [selfReport, setSelfReport] = useState(true);

  const jr = parseFloat(jpyRate) || 0;
  const ur = parseFloat(usdRate) || 0;

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

  const travel = useMemo(() => {
    const totalKrw = (parseFloat(travelTotal) || 0) * jr;
    const totalUsd = ur ? totalKrw / ur : NaN;
    const limitKrw = TRAVELER_LIMIT_USD * ur;
    const over = Math.max(0, totalKrw - limitKrw);
    const taxed = ur ? over > 0 : false;
    let tax = taxed ? over * 0.2 : 0;
    let discount = taxed && selfReport ? Math.min(tax * 0.3, 200_000) : 0;
    return { totalKrw, totalUsd, limitKrw, over, taxed, tax, discount, finalTax: tax - discount };
  }, [travelTotal, selfReport, jr, ur]);

  const tabBtn = (id, label) => (
    <button key={id} onClick={() => setTab(id)} style={{
      flex: 1, padding: "11px 0", fontSize: 14.5, fontWeight: 700, cursor: "pointer",
      border: "none", borderRadius: 9,
      background: tab === id ? T.indigo : "transparent",
      color: tab === id ? "#fff" : T.muted,
      transition: "background .15s, color .15s",
    }}>{label}</button>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.paper, padding: "28px 16px 60px", fontFamily: `'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif`, color: T.ink }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* 헤더 */}
        <header style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: T.red, marginBottom: 6 }}>
            円 → ₩ · KOREA CUSTOMS
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em" }}>
            엔화 직구 · 여행 세금 계산기
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: T.muted, lineHeight: 1.5 }}>
            일본 직구 관부가세와 여행자 휴대품 세금을 실시간 환율로 계산하고, 일본·국내 가격을 비교합니다. 2026년 7월 규정 기준, 참고용입니다.
          </p>
        </header>

        {/* 환율 설정 */}
        <section style={{ background: T.indigoSoft, borderRadius: 14, padding: "14px 16px 2px", marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <RateBadge
              status={status}
              source={rates?.source}
              fetchedAt={fetchedAt}
              overridden={overridden}
              onRefresh={refresh}
              onReset={resetToLive}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <NumField label="JPY → KRW" suffix="원 / 1엔" value={jpyRate} onChange={editRate(setJpyRate)} />
            <NumField label="USD → KRW" suffix="원 / 1달러" value={usdRate} onChange={editRate(setUsdRate)} hint="면세한도(달러) 환산에 사용" />
          </div>
        </section>

        {/* 탭 */}
        <nav style={{ display: "flex", gap: 6, background: T.card, border: `1.5px solid ${T.line}`, borderRadius: 12, padding: 5, marginBottom: 16 }}>
          {tabBtn("shop", "직구 계산기")}
          {tabBtn("travel", "여행자 휴대품")}
          {tabBtn("compare", "가격 비교")}
        </nav>

        {/* ── 가격 비교 탭 ── */}
        {tab === "compare" && <CompareTab jpyKrw={jr} usdKrw={ur} />}

        {/* ── 직구 탭 ── */}
        {tab === "shop" && (
          <>
            <section style={{ background: T.card, border: `1.5px solid ${T.line}`, borderRadius: 14, padding: "18px 18px 6px", marginBottom: 16 }}>
              <NumField label="상품 가격" suffix="¥" value={price} onChange={setPrice} />
              <NumField label="일본 내 배송비·수수료" suffix="¥" value={localShip} onChange={setLocalShip} hint="면세 판정 기준인 '물품가격'에 포함됩니다" />
              <NumField label="국제 배송비 (배대지·특송)" suffix="₩" value={intlShip} onChange={setIntlShip} hint="면세 판정에는 빠지지만, 과세 시 과세가격에 포함됩니다" />
              <label style={{ display: "block", marginBottom: 14 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.indigo, marginBottom: 5 }}>품목</span>
                <select value={catId} onChange={(e) => setCatId(e.target.value)} style={{
                  width: "100%", padding: "12px 12px", fontSize: 15, fontWeight: 600, color: T.ink,
                  border: `1.5px solid ${T.line}`, borderRadius: 10, background: "#FCFDFB", outline: "none",
                }}>
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
        )}

        {/* ── 여행 탭 ── */}
        {tab === "travel" && (
          <>
            <section style={{ background: T.card, border: `1.5px solid ${T.line}`, borderRadius: 14, padding: "18px 18px 6px", marginBottom: 16 }}>
              <NumField label="일본에서 구매한 총 금액" suffix="¥" value={travelTotal} onChange={setTravelTotal} hint="면세점 구매 포함, 국내 반입하는 물품 전체" />
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
                  <>
                    <Row label="면세한도 초과분" value={won(travel.over)} />
                    <Row label="예상 세액 (간이세율 20% 가정)" value={won(travel.tax)} />
                    {travel.discount > 0 && <Row label="자진신고 감면 (−30%)" value={"−" + won(travel.discount)} />}
                    <Row label="납부 예상 세액" value={won(travel.finalTax)} strong red top />
                  </>
                ) : (
                  <Row label="납부 예상 세액" value="0원" strong top />
                )}
              </div>
            </section>

            <p style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.7, marginTop: 14 }}>
              · 간이세율은 품목별로 다르며(대략 15~55%), 여기서는 일반적인 20%를 가정했습니다.<br />
              · 술(2병·2L·$400 이내)·담배(궐련 200개비)·향수(100mL)는 기본 면세한도와 별도로 적용됩니다.<br />
              · 신고 대상을 신고하지 않고 적발되면 세액의 40%(반복 시 60%) 가산세가 부과됩니다.
            </p>
          </>
        )}

        <footer style={{ marginTop: 28, paddingTop: 14, borderTop: `1px solid ${T.line}`, fontSize: 11, color: T.muted, textAlign: "center" }}>
          본 계산기는 참고용이며 법적 효력이 없습니다 · 기준: 2026.07
        </footer>
      </div>
    </div>
  );
}
