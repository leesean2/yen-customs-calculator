import { useState } from "react";
import { T, chipBtn, panel } from "./ui.jsx";
import {
  loadSavedCalcs, saveSavedCalcs, newSavedCalc, MAX_SAVED_CALCS,
  exportSavedCalcs, parseImportedSavedCalcs, mergeSavedCalcs,
} from "./lib/savedCalcs.js";
import { todayStr } from "./lib/orders.js";
import JsonBackupRow from "./JsonBackupRow.jsx";
import SavedCompareBlock from "./SavedCompareBlock.jsx";
import useFlash from "./hooks/useFlash.js";

const MAX_COMPARE = 3;

/* 계산 저장함 카드 (직구 탭 결과 아래) — 현재 계산을 이름 붙여 보관.
   makeSnapshot(): { query, summary } — 부모(ShopTab)가 공유 링크와 같은
   스냅샷 쿼리를 만들어 준다. 불러오기는 그 쿼리로 이동해 공유 링크
   복원 경로를 그대로 재사용한다(입력값·환율까지 저장 시점 그대로). */
export default function SavedCalcsCard({ makeSnapshot }) {
  const [saved, setSaved] = useState(loadSavedCalcs);
  const [name, setName] = useState("");
  const [justSaved, flashSaved] = useFlash();
  // 비교 선택 — 2건 이상 고르면 아래 비교 블록이 열린다 (최대 MAX_COMPARE건)
  const [selected, setSelected] = useState([]);

  const persist = (list) => {
    setSaved(list);
    saveSavedCalcs(list);
    // 삭제·가져오기로 사라진 항목은 비교 선택에서도 뺀다
    setSelected((ids) => ids.filter((id) => list.some((s) => s.id === id)));
  };
  const toggleSelect = (id) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id)
      : ids.length >= MAX_COMPARE ? ids
      : [...ids, id]
    );

  const full = saved.length >= MAX_SAVED_CALCS;
  const save = () => {
    if (full) return;
    const { query, summary } = makeSnapshot();
    persist([newSavedCalc({ name, query, summary }), ...saved]);
    setName("");
    flashSaved();
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
              {saved.length >= 2 && (
                <input
                  type="checkbox" aria-label={`${s.name} 비교 선택`}
                  checked={selected.includes(s.id)}
                  disabled={!selected.includes(s.id) && selected.length >= MAX_COMPARE}
                  onChange={() => toggleSelect(s.id)}
                  style={{ width: 15, height: 15, accentColor: T.indigo, flexShrink: 0, alignSelf: "center" }}
                />
              )}
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
      {saved.length >= 2 && selected.length < 2 && (
        <p style={{ margin: "6px 0 0", fontSize: 11, color: T.muted }}>
          체크로 2~{MAX_COMPARE}건을 고르면 아래에서 나란히 비교합니다 (합산과세 시나리오 포함).
        </p>
      )}
      {selected.length >= 2 && (
        <SavedCompareBlock entries={saved.filter((s) => selected.includes(s.id))} />
      )}

      <JsonBackupRow
        exportText={() => exportSavedCalcs(saved)}
        filename={`yen-calc-saved-${todayStr()}.json`}
        exportDisabled={saved.length === 0}
        fileLabel="계산 저장함 JSON 파일"
        onImportText={(text) => {
          const next = mergeSavedCalcs(saved, parseImportedSavedCalcs(text));
          // 저장함이 가득해 기존 항목과 교체될 수 있으므로, 길이 차가 아닌
          // '새로 들어온 id 수'를 센다
          const before = new Set(saved.map((s) => s.id));
          const added = next.filter((s) => !before.has(s.id)).length;
          persist(next);
          return `✓ ${added}건 가져옴 (중복 제외, 최대 ${MAX_SAVED_CALCS}건)`;
        }}
      />
      <p style={{ margin: "8px 0 0", fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
        저장함은 이 브라우저에만 보관됩니다(서버 전송 없음). 열면 저장 시점의 환율로 계산됩니다.
      </p>
    </section>
  );
}
