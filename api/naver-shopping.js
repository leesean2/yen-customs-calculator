/**
 * 네이버 쇼핑 검색 프록시 (Vercel Serverless Function)
 * 네이버 오픈API는 브라우저 직접 호출(CORS)이 불가하고 키가 노출되면 안 되므로 서버에서 중계한다.
 * 필요 환경변수: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET (developers.naver.com에서 발급)
 */
export default async function handler(req, res) {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) {
    return res.status(200).json({ configured: false, items: [] });
  }

  const q = (req.query.q || "").toString().trim().slice(0, 80);
  if (!q) return res.status(400).json({ error: "q(검색어)가 필요합니다" });

  try {
    const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(q)}&display=8&sort=sim`;
    const r = await fetch(url, {
      headers: { "X-Naver-Client-Id": id, "X-Naver-Client-Secret": secret },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return res.status(502).json({ error: `naver HTTP ${r.status}` });
    const data = await r.json();

    // 상품명에는 <b> 태그와 &amp; 같은 HTML 엔티티가 섞여 온다
    const cleanTitle = (s) =>
      s.replace(/<[^>]*>/g, "")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ");

    // lprice는 네이버 카탈로그 기준 최저가(문자열)
    const items = (data.items ?? []).map((it) => ({
      title: cleanTitle(it.title),
      price: Number(it.lprice) || 0,
      mall: it.mallName || "네이버쇼핑",
      link: it.link,
      image: it.image,
    })).filter((it) => it.price > 0);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ configured: true, items });
  } catch (e) {
    return res.status(502).json({ error: e?.message || "naver fetch failed" });
  }
}
