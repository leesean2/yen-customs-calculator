/**
 * 클라이언트 진단 수집 (src/lib/monitor.js가 전송) — 개인정보 없는 기술 로그만 받는다.
 *
 * Vercel 함수 로그(console)로 남겨 대시보드에서 클라이언트 실패 지점을 파악한다.
 * 외부 모니터링 계정 불필요. 화이트리스트 필드만 로깅해 예상 밖 대형/민감 데이터를 차단한다.
 */
const str = (v, n) => (v == null ? undefined : String(v).slice(0, n));
const num = (v) => (Number.isFinite(+v) ? +v : undefined);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    // 본문 크기 제한 — 로그 폭주·악용 방지 (sendBeacon은 문자열, JSON 파싱은 객체로 도착)
    const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
    if (raw.length > 4000) return res.status(413).end();
    const data =
      req.body && typeof req.body === "object" ? req.body : JSON.parse(raw || "{}");

    // 화이트리스트 — 정의되지 않은 필드는 로깅하지 않는다
    const safe = {
      kind: str(data.kind, 40),
      event: str(data.event, 60),
      message: str(data.message, 300),
      path: str(data.path, 200),
      source: str(data.source, 200),
      line: num(data.line),
      col: num(data.col),
      stack: str(data.stack, 600),
      v: str(data.v, 40),
      // 환율 폴백 체인 진단
      depth: num(data.depth),
      used: str(data.used, 80),
      failed: Array.isArray(data.failed) ? data.failed.slice(0, 8).map((x) => str(x, 80)) : undefined,
      ua: str(req.headers["user-agent"], 200),
    };
    // 대시보드에서 grep 가능한 단일 라인 JSON
    console.error("[client-diag]", JSON.stringify(safe));
    return res.status(204).end();
  } catch {
    return res.status(400).end();
  }
}
