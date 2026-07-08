/**
 * 실시간(장중) 환율 — 하나은행 고시(네이버 금융 경유), 실패 시 일간 소스 폴백
 * 무료 일간 소스(er-api 등)의 "하루 1회 갱신" 한계를 보완한다.
 */
import { fromNaverFinance, fromErApi, fromFrankfurter } from "./_lib/rates.js";

export default async function handler(req, res) {
  for (const fn of [fromNaverFinance, fromErApi, fromFrankfurter]) {
    try {
      const rate = await fn();
      res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
      return res.status(200).json({ ...rate, at: Date.now() });
    } catch { /* 다음 소스 */ }
  }
  return res.status(502).json({ error: "모든 환율 소스 조회 실패" });
}
