import { useEffect, useState } from "react";
import useExchangeRates from "./hooks/useExchangeRates.js";
import useRateAlert from "./hooks/useRateAlert.js";
import { T, NumField, chipBtn } from "./ui.jsx";
import { RATES_LAST_VERIFIED, RATES_STALE_AFTER_DAYS } from "./data/categories.js";
import { readShareParams } from "./lib/share.js";
import ShopTab from "./ShopTab.jsx";
import TravelTab from "./TravelTab.jsx";
import RouteCompareTab from "./RouteCompareTab.jsx";
import CompareTab from "./CompareTab.jsx";
import AlertTab from "./AlertTab.jsx";
import TrendPanel from "./TrendPanel.jsx";

/* ──────────────────────────────────────────────
   엔화 직구 · 여행 관부가세 계산기 (실시간 환율)
   기준: 2026-07 관세청 규정 (참고용 계산)
   각 탭의 입력·계산은 해당 탭 컴포넌트가 소유하고,
   App은 환율 상태·알림 배너·탭 전환만 담당한다.
   ────────────────────────────────────────────── */

/* 환율 상태 배지 */
function RateBadge({ status, source, fetchedAt, overridden, onRefresh, onReset }) {
  const dot = {
    live: T.green,
    cached: T.warnLine,
    loading: T.muted,
    error: T.red,
  }[status];
  const text = overridden
    ? "직접 입력한 환율 사용 중"
    : {
        live: `실시간 환율 · ${source ?? ""}`,
        cached: "저장된 환율 사용 중",
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

const badgeBtnStyle = chipBtn();

const TABS = [
  { id: "shop", label: "직구" },
  { id: "travel", label: "여행자" },
  { id: "route", label: "직구·여행" },
  { id: "compare", label: "국내비교" },
  { id: "alert", label: "알림" },
];

export default function App() {
  // 한 번 방문한 탭은 숨김 처리(display:none)로 유지 — 입력값과 검사 결과가 탭 전환에도 보존된다
  const [tab, setTab] = useState("shop");
  const [visited, setVisited] = useState({ shop: true });
  const openTab = (id) => {
    setTab(id);
    setVisited((v) => (v[id] ? v : { ...v, [id]: true }));
  };

  // ── 공유 링크로 진입한 경우: 입력값·환율을 링크의 스냅샷으로 복원 ──
  const [shared] = useState(readShareParams);

  // ── 환율: API 값 ↔ 수동 입력 ──
  const { rates, status, fetchedAt, refresh } = useExchangeRates();
  const [jpyRate, setJpyRate] = useState(shared?.j ?? "");
  const [usdRate, setUsdRate] = useState(shared?.u ?? "");
  // 공유된 환율은 수동 입력 취급 — 실시간 값이 덮어쓰면 보낸 사람과 결과가 달라진다
  const [overridden, setOverridden] = useState(!!(shared?.j || shared?.u));

  // API 값 도착 시, 사용자가 수동 수정하지 않았다면 자동 반영
  // 입력·표시는 국내 관행대로 100엔 기준, 내부 계산(jr)은 1엔당 원화
  useEffect(() => {
    if (rates && !overridden) {
      setJpyRate((rates.jpyKrw * 100).toFixed(2));
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
      setJpyRate((rates.jpyKrw * 100).toFixed(2));
      setUsdRate(rates.usdKrw.toFixed(0));
    } else {
      refresh();
    }
  };

  const jr = (parseFloat(jpyRate) || 0) / 100;
  const ur = parseFloat(usdRate) || 0;

  // 목표 환율 알림 — 수동 입력값이 아닌 실시간 API 환율(krwPer) 기준으로 판정
  const rateAlert = useRateAlert(rates?.krwPer, refresh);

  // 세율·한도 데이터 신선도 — 기준일에서 일정 기간이 지나면 확인 배너
  const rateDataAgeDays = Math.floor(
    (Date.now() - new Date(`${RATES_LAST_VERIFIED}T00:00:00`).getTime()) / 86400000
  );
  const rateDataStale = rateDataAgeDays > RATES_STALE_AFTER_DAYS;

  const tabPanel = (id, node) =>
    visited[id] ? <div style={{ display: tab === id ? undefined : "none" }}>{node}</div> : null;

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
            일본·미국·유럽·중국 직구 관부가세와 여행자 휴대품 세금을 실시간 환율로 계산하고, 해외·국내 가격을 비교합니다. 2026년 7월 규정 기준, 참고용입니다.
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
            <NumField label="JPY → KRW" suffix="원 / 100엔" value={jpyRate} onChange={editRate(setJpyRate)} />
            <NumField label="USD → KRW" suffix="원 / 1달러" value={usdRate} onChange={editRate(setUsdRate)} hint="면세한도(달러) 환산에 사용" />
          </div>
        </section>

        {/* 환율 추이 차트 — 탭 밖(전역)이라 어느 탭에서든 실시간 환율과 함께 본다 */}
        <TrendPanel rateAlert={rateAlert} />

        {/* 세율 데이터 신선도 배너 — 법령 개정 가능성을 알린다 */}
        {rateDataStale && (
          <div style={{
            background: T.warnBg, border: `1.5px solid ${T.warnLine}`, borderRadius: 12,
            padding: "10px 14px", marginBottom: 14, fontSize: 12.5, color: T.warnInk,
            fontWeight: 600, lineHeight: 1.6,
          }}>
            ⚠️ 세율·한도 데이터 기준일({RATES_LAST_VERIFIED})에서 {rateDataAgeDays}일이 지나
            세율이 최신인지 확인이 필요합니다. 관세율·면세한도가 개정됐을 수 있으니{" "}
            <a href="https://www.customs.go.kr" target="_blank" rel="noreferrer" style={{ color: T.indigo, fontWeight: 700 }}>
              관세청 고시
            </a>
            와 대조해 확인하세요.
          </div>
        )}

        {/* 목표 환율 도달 배너 — 어느 탭에서든 표시 */}
        {rateAlert.triggered && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            background: T.greenSoft, border: `1.5px solid ${T.green}`, borderRadius: 12,
            padding: "10px 14px", marginBottom: 14, fontSize: 13.5, color: T.green, fontWeight: 700,
          }}>
            <span>🔔 목표 환율 도달 — 현재 {rateAlert.unitText} = {rateAlert.liveText}원 (목표 {rateAlert.config.target}원 {rateAlert.config.dir === "below" ? "이하" : "이상"})</span>
            <span style={{ flex: 1 }} />
            <button onClick={() => rateAlert.update({ enabled: false })} style={badgeBtnStyle}>
              알림 끄기
            </button>
          </div>
        )}

        {/* 탭 */}
        <nav style={{ display: "flex", gap: 4, background: T.card, border: `1.5px solid ${T.line}`, borderRadius: 12, padding: 5, marginBottom: 16 }}>
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => openTab(id)} style={{
              flex: 1, padding: "11px 2px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              border: "none", borderRadius: 9, whiteSpace: "nowrap",
              background: tab === id ? T.indigo : "transparent",
              color: tab === id ? "#fff" : T.muted,
              transition: "background .15s, color .15s",
            }}>{label}</button>
          ))}
        </nav>

        {tabPanel("shop", <ShopTab jr={jr} ur={ur} krwPer={rates?.krwPer} shared={shared} />)}
        {tabPanel("travel", <TravelTab jr={jr} ur={ur} krwPer={rates?.krwPer} />)}
        {tabPanel("route", <RouteCompareTab jr={jr} ur={ur} krwPer={rates?.krwPer} />)}
        {tabPanel("compare", <CompareTab jr={jr} ur={ur} krwPer={rates?.krwPer} />)}
        {tabPanel("alert", <AlertTab rateAlert={rateAlert} />)}

        <footer style={{ marginTop: 28, paddingTop: 14, borderTop: `1px solid ${T.line}`, fontSize: 11, color: T.muted, textAlign: "center" }}>
          본 계산기는 참고용이며 법적 효력이 없습니다 · 세율 기준일: {RATES_LAST_VERIFIED}
        </footer>
      </div>
    </div>
  );
}
