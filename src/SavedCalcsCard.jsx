import { useEffect, useRef, useState } from "react";
import { T, chipBtn, panel } from "./ui.jsx";
import { loadSavedCalcs, saveSavedCalcs, newSavedCalc, MAX_SAVED_CALCS } from "./lib/savedCalcs.js";

/* 계산 저장함 카드 (직구 탭 결과 아래) — 현재 계산을 이름 붙여 보관.
   makeSnapshot(): { query, summary } — 부모(ShopTab)가 공유 링크와 같은
   스냅샷 쿼리를 만들어 준다. 불러오기는 그 쿼리로 이동해 공유 링크
   복원 경로를 그대로 재사용한다(입력값·환율까지 저장 시점 그대로). */
export default function SavedCalcsCard({ makeSnapshot }) {
  const [saved, setSaved] = useState(loadSavedCalcs);
  const [name, setName] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const persist = (list) => { setSaved(list); saveSavedCalcs(list); };

  const full = saved.length >= MAX_SAVED_CALCS;
  const save = () => {
    if (full) return;
    const { query, summary } = makeSnapshot();
    persist([newSavedCalc({ name, query, summary }), ...saved]);
    setName("");
    setJustSaved(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setJustSaved(false), 2500);
  };

  const open = (s) => {
    // 페이지 이동으로 복원 — 현재 입력은 사라지지만, 공유 링크와 동일한
    // 단일 복원 경로를 유지하는 쪽이 스냅샷 재현을 보장한다
    window.location.href = `${window.location.pathname}${s.query}`;
  };

  return (
    <section style={{ ...panel(), padding: "16px 16px 12px", marginTop: 16 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, marginBottom: 8 }}>
        💾 계산 저장함 <span style={{ fontWeight: 600, color: T.muted, fontSize: 12 }}>({saved.length}/{MAX_SAVED_CALCS}건)</span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder="저장 이름 (예: 피규어 예약분)" aria-label="저장 이름"
          maxLength={40}
          onKeyDown={(e) => e.key === "Enter" && save()}
          style={{
            // fontSize 16: iOS Safari 포커스 확대 방지
            flex: 1, minWidth: 0, border: `1.5px solid ${T.line}`, borderRadius: 8,
            background: T.field, padding: "8px 10px", fontSize: 16, fontWeight: 600,
            color: T.ink, outline: "none",
          }}
        />
        <button onClick={save} disabled={full} style={chipBtn({ solid: true, disabled: full })}>
          {justSaved ? "✓ 저장됨" : "현재 계산 저장"}
        </button>
      </div>
      {full && (
        <p style={{ margin: "6px 0 0", fontSize: 11.5, color: T.red, fontWeight: 600 }}>
          저장함이 가득 찼습니다 — 안 쓰는 항목을 지우고 저장하세요.
        </p>
      )}
      {saved.length === 0 ? (
        <p style={{ margin: "8px 0 4px", fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
          입력값과 환율이 그대로 저장돼, 나중에 열어도 지금과 같은 계산을 봅니다.
          구매를 고민 중인 상품을 담아 두고 비교해 보세요.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
          {saved.map((s) => (
            <li key={s.id} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "7px 0", borderTop: `1px solid ${T.line}`, fontSize: 12.5 }}>
              <span style={{ color: T.muted, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{s.savedAt}</span>
              <span style={{ fontWeight: 700, color: T.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
              <span style={{ color: T.muted, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{s.summary}</span>
              <button onClick={() => open(s)} style={{ ...chipBtn(), flexShrink: 0 }}>열기</button>
              <button onClick={() => persist(saved.filter((x) => x.id !== s.id))} aria-label={`${s.name} 삭제`} style={{
                border: "none", background: "transparent", color: T.muted, cursor: "pointer", fontSize: 14, padding: "0 2px", flexShrink: 0,
              }}>×</button>
            </li>
          ))}
        </ul>
      )}
      <p style={{ margin: "8px 0 0", fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
        저장함은 이 브라우저에만 보관됩니다(서버 전송 없음). 열면 저장 시점의 환율로 계산됩니다.
      </p>
    </section>
  );
}
