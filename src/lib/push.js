/** 웹 푸시 클라이언트 헬퍼 — 서비스워커 등록·구독·해제 */
import { timeoutSignal } from "./net.js";

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported() {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    typeof Notification !== "undefined"
  );
}

async function getRegistration() {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return reg;
}

/** 현재 브라우저의 구독 객체 (없으면 null) —
 *  상태 확인만 하므로 서비스워커를 새로 설치하지 않는다 */
export async function getPushSubscription() {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** 구독 생성/갱신 후 서버에 목표 조건과 함께 저장 */
export async function subscribePush({ target, dir, anomaly = true }) {
  const cfgRes = await fetch("/api/push", { signal: timeoutSignal(10_000) });
  if (!cfgRes.headers.get("content-type")?.includes("json")) {
    throw new Error("푸시 API에 연결할 수 없습니다 (로컬 개발 시 vercel dev 필요)");
  }
  const cfg = await cfgRes.json();
  if (!cfg.configured) throw new Error("서버에 푸시 키(VAPID)가 설정되지 않았습니다");

  const reg = await getRegistration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cfg.publicKey),
    }));

  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), target, dir, anomaly }),
    signal: timeoutSignal(10_000),
  });
  if (!res.ok) throw new Error("구독 정보를 서버에 저장하지 못했습니다");
  return sub;
}

/** 서버 기록과 브라우저 구독을 모두 해제 */
export async function unsubscribePush() {
  const sub = await getPushSubscription();
  if (!sub) return;
  await fetch("/api/push", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
    signal: timeoutSignal(10_000),
  }).catch(() => { /* 서버 기록은 크론의 410 정리로도 제거된다 */ });
  await sub.unsubscribe();
}
