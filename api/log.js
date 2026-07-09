/**
 * 클라이언트 진단 수집 (src/lib/monitor.js가 전송) — 개인정보 없는 기술 로그만 받는다.
 *
 * 1) 항상: Vercel 함수 로그(console)로 남겨 대시보드에서 클라이언트 실패 지점을 파악.
 * 2) 선택: 환경변수 SENTRY_DSN이 설정되면 Sentry로도 전달(서버에서만 — DSN 비공개 유지,
 *    클라이언트 SDK 불필요). 미설정이면 콘솔 로깅만 하고 조용히 넘어간다.
 * 화이트리스트 필드만 처리해 예상 밖 대형/민감 데이터를 차단한다.
 */
import { randomUUID } from "node:crypto";

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

    // 화이트리스트 — 정의되지 않은 필드는 처리하지 않는다
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

    // 선택: Sentry 전달 (실패가 응답을 막지 않도록 무해 처리)
    if (process.env.SENTRY_DSN) {
      await forwardToSentry(safe).catch((e) => console.error("[client-diag] sentry forward 실패:", e?.message));
    }
    return res.status(204).end();
  } catch {
    return res.status(400).end();
  }
}

/** DSN(https://<key>@<host>/<projectId>)에서 envelope 엔드포인트와 public key 추출.
 *  self-hosted처럼 경로 프리픽스가 있어도 프로젝트 ID 앞 경로를 보존한다. */
function parseDsn(dsn) {
  const u = new URL(dsn);
  const segments = u.pathname.split("/").filter(Boolean);
  const projectId = segments.pop();
  if (!u.username || !projectId) throw new Error("잘못된 SENTRY_DSN 형식");
  const path = segments.length ? "/" + segments.join("/") : "";
  return { url: `${u.protocol}//${u.host}${path}/api/${projectId}/envelope/`, publicKey: u.username };
}

/** 진단을 Sentry 이벤트(envelope)로 전송. 의존성 없이 HTTP 인제스트 직접 호출. */
async function forwardToSentry(safe) {
  const { url, publicKey } = parseDsn(process.env.SENTRY_DSN);
  const isError = safe.kind === "error" || safe.kind === "unhandledrejection";
  const eventId = randomUUID().replace(/-/g, "");
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: "javascript",
    logger: "client-diag",
    level: isError ? "error" : safe.event === "rate_all_failed" ? "warning" : "info",
    release: safe.v,
    environment: process.env.VERCEL_ENV || "production",
    tags: { kind: safe.kind, diag_event: safe.event },
    extra: {
      path: safe.path, source: safe.source, line: safe.line, col: safe.col,
      stack: safe.stack, depth: safe.depth, used: safe.used, failed: safe.failed,
    },
    request: { url: safe.path, headers: safe.ua ? { "User-Agent": safe.ua } : undefined },
  };
  if (isError) {
    event.exception = { values: [{ type: safe.kind || "Error", value: safe.message || "(no message)" }] };
  } else {
    const parts = [safe.event];
    if (safe.used) parts.push(`via ${safe.used} (depth ${safe.depth})`);
    if (safe.failed?.length) parts.push(`failed=[${safe.failed.join(",")}]`);
    event.message = { formatted: parts.join(" ") };
  }

  const envelope =
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }) + "\n" +
    JSON.stringify({ type: "event" }) + "\n" +
    JSON.stringify(event) + "\n";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-sentry-envelope",
      "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=yen-calc-diag/1.0`,
    },
    body: envelope,
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`Sentry HTTP ${res.status}`);
}
