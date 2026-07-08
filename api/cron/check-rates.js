/**
 * 환율 검사 크론 — Vercel Cron이 호출 (Hobby 플랜은 하루 1회 제한)
 * 1) 목표 환율 도달 구독자에게 푸시 발송
 * 2) 소스 간 편차 3% 이상이면 이상 감지 구독자에게 경고 푸시
 * 같은 종류의 알림은 20시간 쿨다운으로 중복 발송을 막는다.
 */
import webpush from "web-push";
import { readSubs, writeSubs } from "../_lib/subs.js";
import { fetchAllSources, median } from "../_lib/rates.js";

const COOLDOWN = 20 * 60 * 60 * 1000;

export default async function handler(req, res) {
  // Vercel Cron은 CRON_SECRET을 Bearer 토큰으로 보낸다 — 외부 호출 차단
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return res.status(503).json({ error: "VAPID 키 미설정" });

  const sources = await fetchAllSources();
  if (!sources.length) return res.status(502).json({ error: "환율 조회 실패" });
  const rate = sources[0].jpyKrw; // 1순위(하나은행 고시) 우선
  const med = median(sources.map((s) => s.jpyKrw));
  const maxDev = Math.max(...sources.map((s) => Math.abs(((s.jpyKrw - med) / med) * 100)));

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:noreply@example.com", pub, priv);

  const subs = await readSubs();
  const keep = [];
  let sent = 0;
  for (const s of subs) {
    let gone = false;
    const trySend = async (kind, payload) => {
      if (Date.now() - (s.lastSent?.[kind] || 0) < COOLDOWN) return;
      try {
        await webpush.sendNotification(s.subscription, JSON.stringify(payload));
        s.lastSent = { ...s.lastSent, [kind]: Date.now() };
        sent++;
      } catch (e) {
        // 404/410 = 브라우저에서 구독이 사라짐 → 저장소에서 제거
        if (e.statusCode === 404 || e.statusCode === 410) gone = true;
      }
    };

    if (s.target > 0 && (s.dir === "below" ? rate <= s.target : rate >= s.target)) {
      await trySend("target", {
        title: "엔화 목표 환율 도달 🔔",
        body: `현재 1엔 = ${rate.toFixed(2)}원 — 목표 ${s.target}원 ${s.dir === "below" ? "이하" : "이상"} (${sources[0].source})`,
        url: "/",
      });
    }
    if (s.anomaly && sources.length >= 2 && maxDev >= 3) {
      await trySend("anomaly", {
        title: "환율 이상 감지 ⚠️",
        body: `환율 소스 간 편차가 ${maxDev.toFixed(1)}%로 비정상적입니다. 고시 오류 또는 급변동 가능성 — 거래 전 교차 확인하세요.`,
        url: "/",
      });
    }
    if (!gone) keep.push(s);
  }
  await writeSubs(keep);

  return res.status(200).json({
    checked: subs.length,
    sent,
    removed: subs.length - keep.length,
    jpyKrw: +rate.toFixed(4),
    maxDevPct: +maxDev.toFixed(2),
    sources: sources.map((s) => s.source),
  });
}
