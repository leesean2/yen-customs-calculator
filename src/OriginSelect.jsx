import { T, rateText, SelectField, linkBtn } from "./ui.jsx";
import { ORIGIN_COUNTRIES } from "./data/countries.js";

/* 출발국 선택 + 적용 환율 상태 힌트 (직구·여행자·직구여행 비교 탭 공용)
   origin: useOriginCountry 반환값. 실패·캐시 상태에서는 재시도 버튼을 붙인다.
   여행자 탭은 label="여행국"·showLimit=false — 직구 소액면세 한도($150/$200)를
   보여주면 여행자 한도($800)와 혼동되기 때문. */
export default function OriginSelectField({ value, onChange, origin, label = "출발국", showLimit = true }) {
  const { country, rate, status, date, retry } = origin;
  const hint = {
    shared: `공유된 환율 ${rateText(rate, country)} 사용 중`,
    app: rate > 0 ? `적용 환율 ${rateText(rate, country)} — 상단 환율 설정을 따릅니다` : null,
    market: `적용 환율 ${rateText(rate, country)} — 실시간 환율`,
    loading: "환율 불러오는 중…",
    live: `적용 환율 ${rateText(rate, country)} · ECB ${date ?? ""} 고시`,
    cached: `저장된 환율 ${rateText(rate, country)} · ECB ${date ?? ""} 고시 — 최신 조회 실패`,
    error: "환율을 불러오지 못했습니다 — 계산이 0원으로 표시됩니다",
  }[status] ?? null;
  const failed = status === "error";
  const stale = failed || status === "cached";

  return (
    <SelectField
      label={label}
      value={value}
      onChange={onChange}
      note={hint && (
        <span style={{ display: "block", fontSize: 11.5, color: failed ? T.red : T.muted, marginTop: 4 }}>
          {hint}
          {stale && (
            <button onClick={retry} style={{ ...linkBtn, marginLeft: 6 }}>
              다시 시도
            </button>
          )}
        </span>
      )}
    >
      {ORIGIN_COUNTRIES.map((c) => (
        <option key={c.id} value={c.id}>
          {c.flag} {c.label}{showLimit ? ` — 면세한도 $${c.deMinimisUsd}` : ""}
        </option>
      ))}
    </SelectField>
  );
}
