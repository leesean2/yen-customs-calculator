/* 공용 테마 · 포매터 · 폼 컴포넌트 (직구/여행/가격비교 탭에서 공유) */

export const T = {
  paper: "#F2F4F1",
  card: "#FFFFFF",
  ink: "#1C2B3A",
  indigo: "#28527A",
  indigoSoft: "#E8EEF4",
  red: "#C13A32",
  green: "#2E6B4F",
  greenSoft: "#E9F2ED",
  redSoft: "#FBEEEC",
  muted: "#75818C",
  line: "#DFE3DD",
};

export const won = (n) =>
  isNaN(n) ? "—" : Math.round(n).toLocaleString("ko-KR") + "원";
export const usd = (n) =>
  isNaN(n) ? "—" : "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
export const yen = (n) =>
  isNaN(n) ? "—" : "¥" + Math.round(n).toLocaleString("ja-JP");

export function NumField({ label, suffix, value, onChange, hint }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, letterSpacing: "0.02em", color: T.indigo, marginBottom: 5 }}>
        {label}
      </span>
      <span style={{ display: "flex", alignItems: "center", border: `1.5px solid ${T.line}`, borderRadius: 10, background: "#FCFDFB", padding: "0 12px" }}>
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
          width: "100%", border: `1.5px solid ${T.line}`, borderRadius: 10, background: "#FCFDFB",
          padding: "11px 12px", fontSize: 15, fontWeight: 600, color: T.ink, outline: "none",
        }}
      />
      {hint && <span style={{ display: "block", fontSize: 11.5, color: T.muted, marginTop: 4 }}>{hint}</span>}
    </label>
  );
}

export const selectStyle = {
  width: "100%", padding: "12px 12px", fontSize: 15, fontWeight: 600, color: T.ink,
  border: `1.5px solid ${T.line}`, borderRadius: 10, background: "#FCFDFB", outline: "none",
};

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
