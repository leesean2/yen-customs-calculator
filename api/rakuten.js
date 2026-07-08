/**
 * 라쿠텐 이치바 상품 검색 프록시 (Vercel Serverless Function)
 * 필요 환경변수: RAKUTEN_APP_ID (webservice.rakuten.co.jp에서 발급)
 */
export default async function handler(req, res) {
  const appId = process.env.RAKUTEN_APP_ID;
  if (!appId) {
    return res.status(200).json({ configured: false, items: [] });
  }

  const q = (req.query.q || "").toString().trim().slice(0, 80);
  if (!q) return res.status(400).json({ error: "q(검색어)가 필요합니다" });

  try {
    const url =
      `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601` +
      `?applicationId=${appId}&keyword=${encodeURIComponent(q)}&hits=8&formatVersion=2`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return res.status(502).json({ error: `rakuten HTTP ${r.status}` });
    const data = await r.json();

    const items = (data.Items ?? []).map((it) => ({
      title: it.itemName,
      price: Number(it.itemPrice) || 0, // 엔화, 세금 포함가
      shop: it.shopName,
      link: it.itemUrl,
      image: it.mediumImageUrls?.[0] ?? null,
    })).filter((it) => it.price > 0);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ configured: true, items });
  } catch (e) {
    return res.status(502).json({ error: e?.message || "rakuten fetch failed" });
  }
}
