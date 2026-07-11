/**
 * 관세율기본조회 프록시 (Vercel Serverless Function)
 * HS부호(10자리)로 실제 관세율을 조회해, 품목 카테고리 대푯값 대신 정확한
 * 세율을 계산에 적용할 수 있게 한다. UNI-PASS 'trrtQry/retrieveTrrt' 사용
 * (실키로 응답 스키마 검증됨 — trrtQryRsltVo 반복, trrtTpcd/trrtTpNm/trrt).
 * 필요 환경변수: UNIPASS_TARIFF_API_KEY (관세환율 키와 별개로 발급).
 *
 * 적용세율: WTO협정세율(C)이 기본세율(A)보다 낮으면 C가 우선 적용된다(관세법).
 * FTA 협정세율은 원산지 증명이 필요하므로 자동 적용하지 않고 최저값만 참고로 준다.
 */
const HOST = "https://unipass.customs.go.kr:38010";

export default async function handler(req, res) {
  const key = process.env.UNIPASS_TARIFF_API_KEY;
  if (!key) return res.status(200).json({ configured: false });

  const hs = String(req.query.hs ?? "").replace(/\D/g, "");
  if (hs.length !== 10) {
    return res.status(400).json({ configured: true, error: "HS부호는 숫자 10자리여야 합니다" });
  }

  try {
    const url = `${HOST}/ext/rest/trrtQry/retrieveTrrt?crkyCn=${key}&hsSgn=${hs}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const xml = await r.text();

    // 오늘 유효한 세율만 (적용기간은 YYYYMMDD)
    const KST = 9 * 60 * 60 * 1000;
    const today = new Date(Date.now() + KST).toISOString().slice(0, 10).replace(/-/g, "");
    const rows = [];
    for (const block of xml.match(/<trrtQryRsltVo>[\s\S]*?<\/trrtQryRsltVo>/g) ?? []) {
      const pick = (tag) => block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1] ?? "";
      const start = pick("aplyStrtDt"), end = pick("aplyEndDt");
      if ((start && today < start) || (end && today > end)) continue;
      const rate = parseFloat(pick("trrt"));
      if (!Number.isFinite(rate)) continue;
      rows.push({ cd: pick("trrtTpcd"), name: pick("trrtTpNm"), rate });
    }
    if (!rows.length) {
      return res.status(200).json({ configured: true, hs, error: "해당 HS부호의 관세율이 없습니다 — 10자리 부호를 확인하세요" });
    }

    const base = rows.find((x) => x.cd === "A")?.rate ?? null;
    const wto = rows.find((x) => x.cd === "C")?.rate ?? null;
    const applied = base != null && wto != null ? Math.min(base, wto) : base ?? wto;
    // FTA 등 그 외 세율 중 최저 — 원산지 증명 시 가능한 하한 참고용
    const others = rows.filter((x) => x.cd !== "A" && x.cd !== "C");
    const ftaMin = others.length
      ? others.reduce((m, x) => (x.rate < m.rate ? x : m))
      : null;

    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({
      configured: true, hs, base, wto, applied,
      appliedName: applied === wto && wto !== base ? "WTO협정세율" : "기본세율",
      ftaMin: ftaMin && applied != null && ftaMin.rate < applied
        ? { rate: ftaMin.rate, name: ftaMin.name }
        : null,
    });
  } catch {
    return res.status(502).json({ configured: true, error: "관세율 조회 실패 — 잠시 후 다시 시도해 주세요" });
  }
}
