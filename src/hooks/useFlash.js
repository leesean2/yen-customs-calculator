import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 잠깐 켜졌다 꺼지는 확인 표시("✓ 저장됨"·"✓ 복사됨" 등) 골격.
 * 켜는 쪽(flash)만 호출하면 ms 뒤 자동으로 꺼지고, 연타 시 타이머를 리셋하며,
 * 언마운트 시 타이머를 정리한다 — 네 카드가 반복하던 패턴을 한 곳으로.
 */
export default function useFlash(ms = 2500) {
  const [on, setOn] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = useCallback(() => {
    setOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), ms);
  }, [ms]);
  return [on, flash];
}
