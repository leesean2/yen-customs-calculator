/* 공용 테마 · 포매터 · 폼 컴포넌트 (직구/여행/가격비교 탭에서 공유)
 *
 * 색상 값은 CSS 변수(var(--c-*))를 가리킨다 — 실제 색은 index.css에서
 * 라이트/다크(prefers-color-scheme) 팔레트로 정의한다. 인라인 style이
 * 전부 이 T를 통해 색을 읽으므로, 변수만 바꾸면 앱 전체가 테마를 따라간다.
 * field: 입력창 배경, subtle: 보조 패널 배경, warn*: 주의(황색) 배너. */
export const T = {
  paper: "var(--c-paper)",
  card: "var(--c-card)",
  ink: "var(--c-ink)",
  indigo: "var(--c-indigo)",
  indigoSoft: "var(--c-indigo-soft)",
  red: "var(--c-red)",
  green: "var(--c-green)",
  greenSoft: "var(--c-green-soft)",
  redSoft: "var(--c-red-soft)",
  muted: "var(--c-muted)",
  line: "var(--c-line)",
  field: "var(--c-field)",
  subtle: "var(--c-subtle)",
  warnBg: "var(--c-warn-bg)",
  warnLine: "var(--c-warn-line)",
  warnInk: "var(--c-warn-ink)",
};

export const won = (n) =>
  isNaN(n) ? "—" : Math.round(n).toLocaleString("ko-KR") + "원";
export const usd = (n) =>
  isNaN(n) ? "—" : "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
export const yen = (n) =>
  isNaN(n) ? "—" : "¥" + Math.round(n).toLocaleString("ja-JP");

/** 출발국 통화 금액 표기 — money(14900, JP) === yen(14900) === "¥14,900"
 *  숫자 묶음은 항상 한국식 콤마: 통화별 로케일(독일식 "1.234")은 소수점으로 오독된다 */
export const money = (n, country) =>
  isNaN(n) ? "—" : country.symbol + Math.round(n).toLocaleString("ko-KR");

/** 환율 표기 — rateText(10, JP) === "1,000원/100엔" (rate는 1단위당 원화) */
export const rateText = (rate, country) =>
  (rate * country.rateUnit).toLocaleString("ko-KR", { maximumFractionDigits: 2 }) +
  "원/" + (country.rateUnit === 1 ? "" : country.rateUnit) + country.rateUnitLabel;

export function NumField({ label, suffix, value, onChange, hint }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, letterSpacing: "0.02em", color: T.indigo, marginBottom: 5 }}>
        {label}
      </span>
      <span style={{ display: "flex", alignItems: "center", border: `1.5px solid ${T.line}`, borderRadius: 10, background: T.field, padding: "0 12px" }}>
        <input
          type="number" inputMode="decimal" min="0" value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", padding: "11px 0", fontSize: 17, fontWeight: 600, color: T.ink, fontVariantNumeric: "tabular-nums", width: "100%" }}
        />
        <span style={{ fontSize: 13, color: T.muted, fontWeight: 600, marginLeft: 8, whiteSpace: "nowrap" }}>{suffix}</span>
      </span>
      {hint && <span style={{ display: "block", fontSize: 11.5, color: T.muted, marginTop: 4 }}>{hint}</span>}
    </label>
  );
}

export function TextField({ label, value, onChange, placeholder, hint }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, letterSpacing: "0.02em", color: T.indigo, marginBottom: 5 }}>
        {label}
      </span>
      <input
        type="text" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          // fontSize 16 미만이면 iOS Safari가 포커스 시 화면을 확대한다 — 모바일에서 16 유지
          width: "100%", border: `1.5px solid ${T.line}`, borderRadius: 10, background: T.field,
          padding: "11px 12px", fontSize: 16, fontWeight: 600, color: T.ink, outline: "none",
        }}
      />
      {hint && <span style={{ display: "block", fontSize: 11.5, color: T.muted, marginTop: 4 }}>{hint}</span>}
    </label>
  );
}

/* 체크박스 + 라벨 (자진신고·알림 활성화 등 탭 공용) */
export function CheckField({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, cursor: "pointer" }}>
      <input
        type="checkbox" checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, accentColor: T.indigo }}
      />
      <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
    </label>
  );
}

/* 카드 패널 공통 골격 — 각 탭의 입력·결과 카드가 공유. 테두리 색만 상황에 따라 바뀐다 */
export const panel = (borderColor = T.line) => ({
  background: T.card,
  border: `1.5px solid ${borderColor}`,
  borderRadius: 14,
});

// SelectField 내부 전용 — 셀렉트가 필요하면 SelectField를 쓴다
const selectStyle = {
  // fontSize 16: iOS Safari 포커스 확대 방지
  width: "100%", padding: "12px 12px", fontSize: 16, fontWeight: 600, color: T.ink,
  border: `1.5px solid ${T.line}`, borderRadius: 10, background: T.field, outline: "none",
};

/* 라벨 + 셀렉트 골격 (각 탭의 품목/출발국/조건 선택 공용)
   children: <option> 목록 · note: 선택 아래 붙는 설명 노드(스타일은 호출부가 소유) */
export function SelectField({ label, value, onChange, note, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, letterSpacing: "0.02em", color: T.indigo, marginBottom: 5 }}>
        {label}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        {children}
      </select>
      {note}
    </label>
  );
}

/* 인장(도장) 스타일 판정 표시 — 직구·여행 탭 공용 */
export function Stamp({ taxed }) {
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

export function Row({ label, value, strong, red, top }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: strong ? "12px 0 2px" : "5px 0",
      borderTop: top ? `1.5px solid ${T.ink}` : "none",
      marginTop: top ? 8 : 0,
    }}>
      <span style={{ fontSize: strong ? 14.5 : 13.5, color: strong ? T.ink : T.muted, fontWeight: strong ? 700 : 500 }}>{label}</span>
      <span style={{ fontSize: strong ? 21 : 14.5, fontWeight: strong ? 800 : 600, color: red ? T.red : T.ink, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}
