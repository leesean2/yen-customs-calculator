import { useMemo, useState } from "react";
import { T, won, yen, money, NumField, SelectField, Row, panel } from "./ui.jsx";
import { CATEGORIES } from "./data/categories.js";
import { calcImportCost } from "./lib/customs.js";
import { timeoutSignal } from "./lib/net.js";
import useOriginCountry from "./hooks/useOriginCountry.js";
import OriginSelectField from "./OriginSelect.jsx";

/* ──────────────────────────────────────────────
   해외 vs 국내 가격 비교 탭 (출발국 선택)
   - 해외: 일본은 라쿠텐 검색(API)+링크, 그 외 나라는 현지 쇼핑몰 검색 링크+수동 입력
   - 국내: 네이버쇼핑 검색(API) 또는 수동 입력
   - 직구 최종가(상품+배송+관부가세)와 국내가를 비교해 판정
   ────────────────────────────────────────────── */

/* 출발국별 해외 가격 소스 — 검색 API는 일본(라쿠텐)만 있고, 나머지는 외부 링크로 확인해
   수동 입력한다 (아마존 등은 키 없이 쓸 수 있는 공개 검색 API가 없다) */
const FOREIGN_SHOPS = {
  JP: {
    title: "일본 가격 (라쿠텐 · 아마존재팬)",
    api: "/api/rakuten",
    placeholder: "라쿠텐 검색 — 일본어 상품명이 정확합니다",
    notConfiguredHint: "(Vercel 환경변수 RAKUTEN_APP_ID 필요)",
    links: [
      { label: "라쿠텐", make: (q) => q ? `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(q)}/` : "https://www.rakuten.co.jp/" },
      { label: "아마존재팬", make: (q) => q ? `https://www.amazon.co.jp/s?k=${encodeURIComponent(q)}` : "https://www.amazon.co.jp/" },
      { label: "요도바시", make: (q) => q ? `https://www.yodobashi.com/?word=${encodeURIComponent(q)}` : "https://www.yodobashi.com/" },
    ],
  },
  US: {
    title: "미국 가격 (아마존 · 이베이)",
    placeholder: "상품명 입력 후 아래 사이트에서 검색",
    links: [
      { label: "아마존", make: (q) => q ? `https://www.amazon.com/s?k=${encodeURIComponent(q)}` : "https://www.amazon.com/" },
      { label: "이베이", make: (q) => q ? `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}` : "https://www.ebay.com/" },
      { label: "월마트", make: (q) => q ? `https://www.walmart.com/search?q=${encodeURIComponent(q)}` : "https://www.walmart.com/" },
    ],
  },
  EU: {
    title: "유럽 가격 (아마존 독일·프랑스)",
    placeholder: "상품명 입력 후 아래 사이트에서 검색",
    links: [
      { label: "아마존 독일", make: (q) => q ? `https://www.amazon.de/s?k=${encodeURIComponent(q)}` : "https://www.amazon.de/" },
      { label: "아마존 프랑스", make: (q) => q ? `https://www.amazon.fr/s?k=${encodeURIComponent(q)}` : "https://www.amazon.fr/" },
      { label: "이베이 독일", make: (q) => q ? `https://www.ebay.de/sch/i.html?_nkw=${encodeURIComponent(q)}` : "https://www.ebay.de/" },
    ],
  },
  CN: {
    title: "중국 가격 (타오바오 · 징둥)",
    placeholder: "상품명 입력 후 아래 사이트에서 검색 (중국어가 정확합니다)",
    links: [
      { label: "타오바오", make: (q) => q ? `https://s.taobao.com/search?q=${encodeURIComponent(q)}` : "https://www.taobao.com/" },
      { label: "징둥", make: (q) => q ? `https://search.jd.com/Search?keyword=${encodeURIComponent(q)}` : "https://www.jd.com/" },
      { label: "알리익스프레스", make: (q) => q ? `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(q)}` : "https://www.aliexpress.com/" },
    ],
  },
};

async function searchApi(path, q) {
  const res = await fetch(`${path}?q=${encodeURIComponent(q)}`, { signal: timeoutSignal(10_000) });
  // vite dev 서버 등 API가 없는 환경에서는 HTML이 돌아온다
  if (!res.headers.get("content-type")?.includes("json")) {
    throw new Error("검색 API에 연결할 수 없습니다 (로컬 개발 시에는 vercel dev로 실행하세요)");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* 검색 입력 + 결과 리스트. onPick(price)로 선택가를 올려보낸다.
   extLinks: API 키가 없어도 쓸 수 있는 외부 사이트 검색 링크 [{label, make(q)}]
   path가 없으면(검색 API가 없는 나라) 입력값을 외부 링크에만 물려주는 모드로 동작 */
function SearchBox({ placeholder, path, priceLabel, onPick, notConfiguredHint, extLinks }) {
  const [q, setQ] = useState("");
  const [state, setState] = useState({ phase: "idle", items: [], error: null });

  const run = async () => {
    if (!path || !q.trim()) return;
    setState({ phase: "loading", items: [], error: null });
    try {
      const data = await searchApi(path, q.trim());
      if (data.configured === false) {
        setState({ phase: "off", items: [], error: null });
      } else {
        setState({ phase: "done", items: data.items, error: null });
      }
    } catch (e) {
      const msg = e.name === "TimeoutError"
        ? "응답 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요."
        : e.message;
      setState({ phase: "error", items: [], error: msg });
    }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
          onKeyDown={(e) => e.key === "Enter" && run()}
          style={{
            // fontSize 16: iOS Safari 포커스 확대 방지
            flex: 1, minWidth: 0, border: `1.5px solid ${T.line}`, borderRadius: 10,
            background: T.field, padding: "10px 12px", fontSize: 16, fontWeight: 600,
            color: T.ink, outline: "none",
          }}
        />
        {path && (
          <button onClick={run} disabled={state.phase === "loading"} style={{
            border: "none", borderRadius: 10, background: T.indigo, color: "#fff",
            padding: "0 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", flexShrink: 0,
          }}>
            {state.phase === "loading" ? "검색 중…" : "검색"}
          </button>
        )}
      </div>

      {extLinks && (
        <div style={{ display: "flex", gap: 12, marginTop: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>사이트에서 직접 검색:</span>
          {extLinks.map((l) => (
            <a key={l.label} href={l.make(q.trim())} target="_blank" rel="noreferrer"
              style={{ fontSize: 11.5, color: T.indigo, fontWeight: 700 }}>
              {l.label} ↗
            </a>
          ))}
        </div>
      )}

      {state.phase === "off" && (
        <p style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.6, margin: "8px 0 0" }}>
          검색 API 키가 아직 설정되지 않았습니다. {notConfiguredHint} 위의 사이트 링크에서 가격을 확인해 직접 입력하면 동일하게 비교할 수 있습니다.
        </p>
      )}
      {state.phase === "error" && (
        <p style={{ fontSize: 11.5, color: T.red, margin: "8px 0 0" }}>검색 실패: {state.error}</p>
      )}
      {state.phase === "done" && state.items.length === 0 && (
        <p style={{ fontSize: 11.5, color: T.muted, margin: "8px 0 0" }}>검색 결과가 없습니다.</p>
      )}

      {state.items.length > 0 && (
        <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, border: `1.5px solid ${T.line}`, borderRadius: 10, overflow: "hidden" }}>
          {state.items.map((it, i) => (
            <li key={i} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
              borderTop: i ? `1px solid ${T.line}` : "none", background: T.card,
            }}>
              {it.image && (
                <img src={it.image} alt="" width={34} height={34}
                  style={{ objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <a href={it.link} target="_blank" rel="noreferrer" style={{
                  display: "block", fontSize: 12, fontWeight: 600, color: T.ink,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: "none",
                }}>
                  {it.title}
                </a>
                <span style={{ fontSize: 11, color: T.muted }}>
                  {it.mall || it.shop} · <b style={{ color: T.ink }}>{priceLabel(it.price)}</b>
                </span>
              </div>
              <button onClick={() => onPick(it.price)} style={{
                border: `1px solid ${T.indigo}`, background: "transparent", color: T.indigo,
                borderRadius: 7, padding: "4px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", flexShrink: 0,
              }}>
                선택
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* 인장 스타일 판정 배지 */
function VerdictStamp({ verdict, countryId }) {
  const conf = {
    japan: { color: T.green, main: "직구 이득", sub: `BUY FROM ${countryId}` },
    korea: { color: T.red, main: "국내 이득", sub: "BUY DOMESTIC" },
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

const cardStyle = { ...panel(), padding: "16px 16px 4px", marginBottom: 14 };
const cardTitle = (flag, text) => (
  <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}>
    <span>{flag}</span>{text}
  </div>
);

export default function CompareTab({ jr, ur, krwPer }) {
  // 해외 측 (jpPrice는 출발국 통화 금액 — 엔이 기본이라 이름을 유지)
  const [countryId, setCountryId] = useState("JP");
  const [jpPrice, setJpPrice] = useState("");
  const [intlShip, setIntlShip] = useState("15000");
  const [catId, setCatId] = useState("hobby");
  // 국내 측
  const [krPrice, setKrPrice] = useState("");

  const origin = useOriginCountry({ countryId, jr, ur, krwPer });
  const { country, rate: or } = origin;
  const shopSrc = FOREIGN_SHOPS[countryId] ?? FOREIGN_SHOPS.JP;
  const cat = CATEGORIES.find((c) => c.id === catId);

  const jp = useMemo(
    () => calcImportCost({
      priceJpy: parseFloat(jpPrice) || 0,
      intlShipKrw: parseFloat(intlShip) || 0,
      cat, jpyKrw: or, usdKrw: ur,
      deMinimisUsd: country.deMinimisUsd,
    }),
    [jpPrice, intlShip, cat, or, ur, country]
  );

  const kr = parseFloat(krPrice) || 0;
  // 판정 조건: 해외 상품가 입력(배송비 기본값만으로 판정 방지) + 환율 로딩 완료
  // (출발국 환율이 0이면 상품가가 0원으로, 달러 환율이 0이면 면세 판정이
  //  불가능해 관부가세가 0원으로 계산돼 각각 오판정이 난다)
  const ready = (parseFloat(jpPrice) || 0) > 0 && kr > 0 && or > 0 && ur > 0;
  const diff = kr - jp.final; // 양수면 직구가 저렴
  const diffPct = ready ? (Math.abs(diff) / kr) * 100 : 0;
  const verdict = !ready ? null : diffPct < 3 ? "even" : diff > 0 ? "japan" : "korea";

  return (
    <>
      {/* 해외 가격 */}
      <section style={cardStyle}>
        {cardTitle(country.flag, shopSrc.title)}
        <OriginSelectField value={countryId} onChange={setCountryId} origin={origin} />
        <SearchBox
          key={countryId} /* 나라를 바꾸면 검색어·결과를 초기화 */
          placeholder={shopSrc.placeholder}
          path={shopSrc.api}
          priceLabel={yen}
          onPick={(p) => setJpPrice(String(p))}
          notConfiguredHint={shopSrc.notConfiguredHint}
          extLinks={shopSrc.links}
        />
        <NumField label={`${country.short} 상품 가격`} suffix={country.symbol} value={jpPrice} onChange={setJpPrice}
          hint="위 링크에서 확인한 현지 세금 포함가를 입력하세요" />
        <NumField label="국제 배송비 (배대지·특송)" suffix="₩" value={intlShip} onChange={setIntlShip} />
        <SelectField label="품목 (관부가세 계산용)" value={catId} onChange={setCatId}>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label} — 관세 {Math.round(c.duty * 100)}%</option>
          ))}
        </SelectField>
      </section>

      {/* 국내 가격 */}
      <section style={cardStyle}>
        {cardTitle("🇰🇷", "국내 최저가 (네이버쇼핑)")}
        <SearchBox
          placeholder="네이버쇼핑 검색 — 한국어 상품명"
          path="/api/naver-shopping"
          priceLabel={won}
          onPick={(p) => setKrPrice(String(p))}
          notConfiguredHint="(Vercel 환경변수 NAVER_CLIENT_ID/SECRET 필요)"
          extLinks={[
            { label: "네이버쇼핑", make: (q) => q ? `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(q)}` : "https://shopping.naver.com/" },
            { label: "다나와", make: (q) => q ? `https://search.danawa.com/dsearch.php?query=${encodeURIComponent(q)}` : "https://www.danawa.com/" },
          ]}
        />
        <NumField label="국내 구매가 (배송비 포함)" suffix="₩" value={krPrice} onChange={setKrPrice} />
      </section>

      {/* 판정 */}
      <section style={{
        ...panel(verdict === "japan" ? T.green : verdict === "korea" ? T.red : T.line),
        padding: 18,
      }}>
        {ready ? (
          <>
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 10 }}>
              <VerdictStamp verdict={verdict} countryId={countryId} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: T.muted, marginBottom: 2 }}>
                  {verdict === "even" ? "가격 차이 3% 미만" : verdict === "japan" ? "직구가 더 저렴합니다" : "국내 구매가 더 저렴합니다"}
                </div>
                <div style={{ fontSize: 21, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: verdict === "japan" ? T.green : verdict === "korea" ? T.red : T.ink }}>
                  {won(Math.abs(diff))} <span style={{ fontSize: 13.5 }}>({diffPct.toFixed(1)}%)</span>
                </div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 1.5 }}>
                  직구 최종가에는 관부가세{jp.taxed ? `(${won(jp.totalTax)})` : " 0원(면세)"}와 국제 배송비가 포함되어 있습니다.
                </div>
              </div>
            </div>
            <div style={{ borderTop: `1px dashed ${T.line}`, paddingTop: 8 }}>
              <Row label={`${country.short} 상품가 (${money(jp.goodsJpy, country)})`} value={won(jp.goodsKrw)} />
              <Row label="국제 배송비" value={won(jp.intl)} />
              <Row label={jp.taxed ? "관부가세 합계" : "관부가세 (면세)"} value={won(jp.totalTax)} red={jp.taxed} />
              <Row label={`${country.flag} 직구 최종가`} value={won(jp.final)} strong top />
              <Row label="🇰🇷 국내 구매가" value={won(kr)} strong />
            </div>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.7 }}>
            {or > 0 && ur > 0
              ? <>양쪽 가격을 검색하거나 직접 입력하면, 세금·배송비까지 합친 <b>직구 최종가</b>와 국내가를 비교해 어느 쪽이 이득인지 판정해 드립니다.</>
              : <>환율을 불러오는 중입니다. 환율이 준비되면 (또는 상단에 직접 입력하면) 비교 판정이 시작됩니다.</>}
          </p>
        )}
      </section>

      <p style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.7, marginTop: 14 }}>
        · 네이버쇼핑 lprice는 카탈로그 기준 최저가로, 옵션·배송비에 따라 실제 결제액과 다를 수 있습니다.<br />
        · 해외 가격은 현지 세금 포함가 기준으로 입력하세요(라쿠텐 표시가는 일본 소비세 포함).
        현지 배송비는 판매자마다 달라 포함하지 않았습니다.<br />
        · 미국·유럽 일부 판매자는 한국 직배송이 없어 배송대행 비용이 추가될 수 있습니다.<br />
        · 직구는 배송 기간(1~2주), 반품 난이도, A/S 불가 가능성도 함께 고려하세요.
      </p>
    </>
  );
}
