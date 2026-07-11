/**
 * 관세청 과세환율 프록시 (Vercel Serverless Function)
 * 실제 세액은 시장 환율이 아니라 관세청이 주 단위로 고시하는 '과세환율'로
 * 계산되므로, 시장 환율 계산과의 괴리를 보여주는 데 쓴다.
 * 필요 환경변수: UNIPASS_API_KEY (unipass.customs.go.kr 오픈API '관세환율정보'
 * 인증키 — 무료 발급). 키가 없으면 { configured: false }로 응답하고 앱은
 * 이 기능을 조용히 숨긴다(bank-rate.js와 같은 패턴).
 *
 * UNI-PASS 응답은 XML(trifFxrtInfoQryRsltVo 반복) — 통화기호(currSgn)와
 * 환율(fxrt)만 뽑는다. JPY 고시는 100엔 기준이라 1엔당으로 정규화한다.
 */
const HOST = "https://unipass.customs.go.kr:38010";
const CURRENCIES = ["USD", "JPY", "EUR", "CNY"]; // data/countries.js의 출발국 통화 + 면세 판정용 USD

export default async function handler(req, res) {
  const key = process.env.UNIPASS_API_KEY;
  if (!key) return res.status(200).json({ configured: false });

  const KST = 9 * 60 * 60 * 1000;
  // 과세환율은 주간 고시라 오늘 날짜 조회로 충분하지만, 고시 공백·전환 시점을
  // 대비해 최대 7일 전까지 거슬러 조회한다 (bank-rate.js와 같은 전략)
  const deadline = Date.now() + 8000;
  for (let back = 0; back < 7; back++) {
    if (Date.now() > deadline) break;
    const ymd = new Date(Date.now() + KST - back * 86400000)
      .toISOString().slice(0, 10).replace(/-/g, "");
    try {
      // imexTp=2: 수입(과세) 환율
      const url = `${HOST}/ext/rest/trifFxrtInfoQry/retrieveTrifFxrtInfo?crkyCn=${key}&qryYymmDd=${ymd}&imexTp=2`;
      const r = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (!r.ok) continue;
      const xml = await r.text();

      const rates = {};
      let appliedFrom = null;
      for (const block of xml.match(/<trifFxrtInfoQryRsltVo>[\s\S]*?<\/trifFxrtInfoQryRsltVo>/g) ?? []) {
        const cur = block.match(/<currSgn>([A-Z]{3})<\/currSgn>/)?.[1];
        const v = parseFloat(block.match(/<fxrt>([\d.]+)<\/fxrt>/)?.[1]);
        if (!CURRENCIES.includes(cur) || !(v > 0)) continue;
        // JPY 고시는 100엔 기준(수백 원대) — 1엔당(한 자릿수 원)으로 정규화
        rates[cur] = cur === "JPY" && v > 100 ? v / 100 : v;
        const dt = block.match(/<aplyBgnDt>(\d{8})<\/aplyBgnDt>/)?.[1];
        if (dt) appliedFrom = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6)}`;
      }

      if (rates.USD) {
        res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
        return res.status(200).json({ configured: true, source: "관세청 과세환율 (주간 고시)", appliedFrom, rates });
      }
    } catch { /* 전일로 재시도 */ }
  }
  return res.status(502).json({ configured: true, error: "관세청 과세환율 응답 없음" });
}
