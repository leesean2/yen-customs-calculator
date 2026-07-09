/**
 * 경량 클라이언트 진단 — 개인정보 없는 '기술 진단'만 서버 로그로 보낸다.
 *
 * 목적: 실사용 중 어디서 얼마나 실패하는지(특히 환율 소스 폴백 체인이 몇 단계까지
 *       떨어지는지, 처리되지 않은 JS 오류) 파악. Vercel 대시보드 함수 로그로 확인.
 * 원칙: 상품가격·구매 이력·환율 입력값 등 개인/거래 데이터는 절대 전송하지 않는다.
 *       (구매 이력의 "서버 전송 없음" 원칙과 충돌하지 않도록 범위를 기술 진단에 한정)
 * 전송처: /api/log — Sentry 등 외부 계정 불필요. 오류 발생이 앱 동작을 막지 않도록 전부 무해 실패.
 *
 * enabled는 initMonitor()가 켠다 — 프로덕션에서만 초기화하므로(main.jsx),
 * 개발/테스트(vite dev)에서는 track()이 조용히 no-op이 된다.
 */
const ENDPOINT = "/api/log";
const MAX_EVENTS = 25; // 세션당 상한 — 로그 폭주 방지
let enabled = false;
let sent = 0;
let appVersion = "dev";
const seen = new Set(); // 동일 메시지 중복 억제

function post(payload) {
  if (!enabled || sent >= MAX_EVENTS) return;
  sent++;
  try {
    const body = JSON.stringify({ ...payload, v: appVersion, at: Date.now() });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
    } else {
      fetch(ENDPOINT, {
        method: "POST", body, keepalive: true,
        headers: { "content-type": "application/json" },
      }).catch(() => {});
    }
  } catch {
    /* 진단 전송 실패가 앱을 방해하면 안 된다 */
  }
}

const clip = (s, n) => String(s ?? "").slice(0, n);
const once = (key) => {
  const k = clip(key, 200);
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
};

/** 구조화 진단 이벤트 — data에는 기술 정보만(가격·개인 입력 금지) */
export function track(event, data = {}) {
  post({ kind: "event", event, ...data });
}

export function initMonitor({ version } = {}) {
  if (enabled || typeof window === "undefined") return;
  enabled = true;
  if (version) appVersion = version;

  window.addEventListener("error", (e) => {
    if (!once(`${e.message}@${e.filename}:${e.lineno}`)) return;
    post({
      kind: "error",
      message: clip(e.message, 300),
      // 쿼리스트링에는 공유 링크의 가격 입력이 담길 수 있어 pathname만 보낸다
      path: typeof location !== "undefined" ? location.pathname : "",
      source: clip(e.filename, 200),
      line: e.lineno || 0,
      col: e.colno || 0,
      stack: clip(e.error?.stack, 600),
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    const message = clip(reason?.message ?? reason, 300);
    if (!once(`rej:${message}`)) return;
    post({
      kind: "unhandledrejection",
      message,
      path: typeof location !== "undefined" ? location.pathname : "",
      stack: clip(reason?.stack, 600),
    });
  });
}
