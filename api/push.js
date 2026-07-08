/**
 * 웹 푸시 구독 관리
 * GET    → { configured, publicKey }  (클라이언트 구독에 필요한 VAPID 공개키)
 * POST   → 구독 등록/갱신 { subscription, target, dir, anomaly }
 * DELETE → 구독 해제 { endpoint }
 */
import { readSubs, writeSubs } from "./_lib/subs.js";

const MAX_SUBS = 500; // 폭주 방지

export default async function handler(req, res) {
  const configured = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.BLOB_READ_WRITE_TOKEN);

  if (req.method === "GET") {
    return res.status(200).json({ configured, publicKey: configured ? process.env.VAPID_PUBLIC_KEY : null });
  }
  if (!configured) return res.status(503).json({ error: "푸시 서버가 설정되지 않았습니다" });

  if (req.method === "POST") {
    const { subscription, target, dir, anomaly } = req.body || {};
    if (
      typeof subscription?.endpoint !== "string" ||
      !subscription.endpoint.startsWith("https://") ||
      !subscription.keys?.p256dh ||
      !subscription.keys?.auth
    ) {
      return res.status(400).json({ error: "유효한 subscription이 필요합니다" });
    }
    const subs = await readSubs();
    const rest = subs.filter((s) => s.subscription?.endpoint !== subscription.endpoint);
    // 같은 브라우저의 재구독은 갱신으로 처리하되, 발송 쿨다운 기록은 초기화
    rest.push({
      subscription,
      target: parseFloat(target) > 0 ? parseFloat(target) : null,
      dir: dir === "above" ? "above" : "below",
      anomaly: anomaly !== false,
      createdAt: Date.now(),
      lastSent: {},
    });
    if (rest.length > MAX_SUBS) rest.splice(0, rest.length - MAX_SUBS);
    await writeSubs(rest);
    return res.status(200).json({ ok: true, count: rest.length });
  }

  if (req.method === "DELETE") {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: "endpoint가 필요합니다" });
    const subs = await readSubs();
    await writeSubs(subs.filter((s) => s.subscription?.endpoint !== endpoint));
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "method not allowed" });
}
