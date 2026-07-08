/** fetch용 타임아웃 시그널 — 미지원 브라우저에서는 undefined(타임아웃 없음) */
export function timeoutSignal(ms) {
  return typeof AbortSignal !== "undefined" && AbortSignal.timeout
    ? AbortSignal.timeout(ms)
    : undefined;
}
