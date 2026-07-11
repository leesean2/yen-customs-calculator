import { useRef, useState } from "react";
import { T, chipBtn } from "./ui.jsx";

/* 카드 하단 JSON 내보내기/가져오기 줄 (구매 이력·계산 저장함 공용)
   localStorage 전용 저장소의 백업·복원 경로 — 파일은 서버로 가지 않는다.
   exportText(): 다운로드할 JSON 문자열 · onImportText(text): 파싱·병합 후
   성공 안내 문구를 반환(형식 오류는 throw → 공통 실패 안내). */
export default function JsonBackupRow({ exportText, filename, exportDisabled, fileLabel, onImportText }) {
  const [ioMsg, setIoMsg] = useState(null); // { ok, text }
  const fileRef = useRef(null);

  const doExport = () => {
    const blob = new Blob([exportText()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택도 change가 발생하도록
    if (!file) return;
    try {
      setIoMsg({ ok: true, text: await onImportText(await file.text()) });
    } catch {
      setIoMsg({ ok: false, text: "가져오기 실패 — 이 앱에서 내보낸 JSON 파일인지 확인하세요" });
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${T.line}` }}>
      <button onClick={doExport} disabled={exportDisabled} style={chipBtn({ disabled: exportDisabled })}>
        ⬇ 내보내기 (JSON)
      </button>
      <button onClick={() => fileRef.current?.click()} style={chipBtn()}>
        ⬆ 가져오기
      </button>
      <input
        ref={fileRef} type="file" accept=".json,application/json"
        aria-label={fileLabel} onChange={onFile} style={{ display: "none" }}
      />
      {ioMsg && (
        <span style={{ fontSize: 11.5, fontWeight: 700, color: ioMsg.ok ? T.green : T.red }}>{ioMsg.text}</span>
      )}
    </div>
  );
}
