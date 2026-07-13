/**
 * 화물통관 진행정보 프록시 (Vercel Serverless Function)
 * 사용자가 화물관리번호(특송업체·EMS가 발급, 흔히 "통관번호"로 불림)를 입력하면
 * 해당 화물이 통관 절차 중 어느 단계인지 UNI-PASS 'cargCsclPrgsInfoQry' 조회로 보여준다.
 * 필요 환경변수: UNIPASS_CARGO_API_KEY (unipass.customs.go.kr 오픈API "화물통관진행정보"
 * 인증키 — 관세환율·관세율 키와 별개로 신청). 키가 없으면 { configured: false }로 응답하고
 * 앱은 이 기능을 조용히 숨긴다(customs-rate.js·tariff-rate.js와 같은 패턴).
 *
 * 응답 XML(cargCsclPrgsInfoQryVo 반복)의 필드명은 공개 연계가이드 문서 없이 커뮤니티
 * 사례로 구성했다 — csclPrgsStts(진행상태명)·prgsStCd(진행상태코드)를 단계별 상태로,
 * prnm/shipNat/cargTp/blPt/ldprCd/dsprNm/wghtUt/cntrGcnt/etprDt를 화물 일반정보로 쓴다.
 * 실키 발급 후 실응답으로 스키마 검증이 필요하다(관세율기본조회 때와 동일한 절차).
 */
const HOST = "https://unipass.customs.go.kr:38010";

export default async function handler(req, res) {
  const key = process.env.UNIPASS_CARGO_API_KEY;
  if (!key) return res.status(200).json({ configured: false });

  const no = String(req.query.no ?? "").trim().toUpperCase();
  if (!no || no.length > 40) {
    return res.status(400).json({ configured: true, error: "화물관리번호를 확인해 주세요" });
  }

  try {
    const url = `${HOST}/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo?crkyCn=${key}&cargMtNo=${encodeURIComponent(no)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const xml = await r.text();

    const steps = [];
    let info = null;
    for (const block of xml.match(/<cargCsclPrgsInfoQryVo>[\s\S]*?<\/cargCsclPrgsInfoQryVo>/g) ?? []) {
      const pick = (tag) => block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1]?.trim() ?? "";
      const status = pick("csclPrgsStts");
      if (!status) continue;
      steps.push({ status, code: pick("prgsStCd"), date: pick("etprDt") });
      info = {
        shipName: pick("prnm"),
        shipNat: pick("shipNat"),
        cargoType: pick("cargTp"),
        loadPort: pick("blPt"),
        unloadPortCd: pick("ldprCd"),
        agent: pick("dsprNm"),
        weightUnit: pick("wghtUt"),
        containerCount: pick("cntrGcnt"),
        arrivedAt: pick("etprDt"),
      };
    }

    if (!steps.length) {
      return res.status(200).json({
        configured: true, no,
        error: "조회 결과가 없습니다 — 화물관리번호를 확인하거나 아직 통관 정보가 등록되지 않았을 수 있습니다",
      });
    }

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
    return res.status(200).json({ configured: true, no, info, steps });
  } catch {
    return res.status(502).json({ configured: true, error: "화물통관 진행정보 조회 실패 — 잠시 후 다시 시도해 주세요" });
  }
}
