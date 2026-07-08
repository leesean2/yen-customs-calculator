/**
 * 한국수출입은행 고시환율 프록시 (Vercel Serverless Function)
 * 시장(API) 환율과 국내 은행 고시환율의 괴리 감지에 사용한다.
 * 필요 환경변수: KOREAEXIM_API_KEY (koreaexim.go.kr 오픈API에서 무료 발급)
 * 주말·공휴일은 고시가 없어 빈 배열이 오므로 최대 7일 전까지 거슬러 조회한다.
 */
const HOSTS = [
  "https://oapi.koreaexim.go.kr",
  "https://www.koreaexim.go.kr",
];

export default async function handler(req, res) {
  const key = process.env.KOREAEXIM_API_KEY;
  if (!key) return res.status(200).json({ configured: false });

  const KST = 9 * 60 * 60 * 1000;
  // 최대 7일 × 2개 호스트를 순차 시도하므로, 함수 실행 제한에 걸리지 않도록
  // 전체 8초 데드라인과 요청별 3.5초 타임아웃을 둔다
  const deadline = Date.now() + 8000;
  outer: for (let back = 0; back < 7; back++) {
    const ymd = new Date(Date.now() + KST - back * 86400000)
      .toISOString().slice(0, 10).replace(/-/g, "");
    for (const host of HOSTS) {
      if (Date.now() > deadline) break outer;
      try {
        const url = `${host}/site/program/financial/exchangeJSON?authkey=${key}&searchdate=${ymd}&data=AP01`;
        const r = await fetch(url, { signal: AbortSignal.timeout(3500) });
        if (!r.ok) continue;
        const arr = await r.json();
        const jpy = Array.isArray(arr) && arr.find((x) => x.cur_unit?.startsWith("JPY"));
        if (jpy?.deal_bas_r) {
          res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
          return res.status(200).json({
            configured: true,
            source: "한국수출입은행 고시 (매매기준율)",
            date: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6)}`,
            // deal_bas_r은 100엔 기준 매매기준율 → 1엔당 원으로 환산
            jpyKrw: parseFloat(jpy.deal_bas_r.replace(/,/g, "")) / 100,
          });
        }
        // 정상 응답이지만 해당 날짜 고시가 없음(주말·공휴일) → 호스트 바꾸지 말고 전일로
        if (Array.isArray(arr)) break;
      } catch { /* 다음 호스트/전일 시도 */ }
    }
  }
  return res.status(502).json({ configured: true, error: "수출입은행 고시환율 응답 없음" });
}
