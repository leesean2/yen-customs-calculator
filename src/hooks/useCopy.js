import useFlash from "./useFlash.js";

/**
 * 클립보드 복사 + "✓ 복사됨" 플래시 (공유 링크·수입신고 초안 공용).
 * 클립보드 API가 막힌 환경(비보안 컨텍스트 등)은 prompt로 직접 복사하게 폴백.
 */
export default function useCopy(promptLabel = "아래 내용을 복사하세요") {
  const [copied, flash] = useFlash();
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      flash();
    } catch {
      window.prompt(promptLabel, text);
    }
  };
  return { copied, copy };
}
