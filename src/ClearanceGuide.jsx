import { T, won, chipBtn, subtleBox, Disclosure } from "./ui.jsx";
import { clearanceGuide, PCCC_URL, CARGO_TRACK_URL } from "./lib/clearance.js";
import { buildDeclarationDraft } from "./lib/declaration.js";
import { todayStr } from "./lib/orders.js";
import useCopy from "./hooks/useCopy.js";

/* 결과 카드 하단 '통관 절차 안내' 토글 (직구 탭) — 판정(면세→목록통관 /
   과세·배제→일반 수입신고)에 맞는 단계별 절차를 보여준다. 처음 직구하는
   사용자가 "세금이 나오면 그 다음에 뭘 해야 하나"에서 막히지 않게 한다.
   과세면 신고에 쓸 값 요약(수입신고 참고 정보)을 복사할 수 있다.
   rate: 출발국 통화 1단위당 원 · hsList: 상품 순서대로 적용된 HS부호(없으면 null) */
export default function ClearanceGuide({ shop, country, rate, hsList }) {
  const { route, steps } = clearanceGuide({
    taxed: shop.taxed,
    hasExcluded: shop.hasExcluded,
    deMinimisUsd: country.deMinimisUsd,
    taxText: won(shop.totalTax),
  });

  const { copied, copy } = useCopy();
  const copyDraft = () =>
    copy(buildDeclarationDraft({ shop, country, rate, hsList, date: todayStr() }));

  return (
    <Disclosure label={`통관 절차 안내 — ${route}`}>
      <div style={{ marginTop: 10, ...subtleBox("4px 12px 10px") }}>
        {steps.map((s, i) => (
          <div key={s.title} style={{ display: "flex", gap: 10, padding: "9px 0", borderTop: i ? `1px solid ${T.line}` : "none" }}>
            <span aria-hidden="true" style={{
              width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 1,
              background: T.indigoSoft, color: T.indigo, fontSize: 11.5, fontWeight: 800,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {i + 1}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, marginBottom: 2 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, wordBreak: "keep-all" }}>{s.desc}</div>
            </div>
          </div>
        ))}
        {shop.taxed && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 0 2px", borderTop: `1px solid ${T.line}` }}>
            <button onClick={copyDraft} style={chipBtn({ solid: copied })}>
              {copied ? "✓ 복사됨" : "📋 수입신고 참고 정보 복사"}
            </button>
            <span style={{ fontSize: 10.5, color: T.muted, lineHeight: 1.5 }}>
              품목·환율·예상 세액 요약 — 특송업체·관세사에 전달할 때 쓰세요
            </span>
          </div>
        )}
        <p style={{ margin: "8px 0 2px", fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
          <a href={PCCC_URL} target="_blank" rel="noreferrer" style={{ color: T.indigo, fontWeight: 700 }}>개인통관고유부호 발급</a>
          {" · "}
          <a href={CARGO_TRACK_URL} target="_blank" rel="noreferrer" style={{ color: T.indigo, fontWeight: 700 }}>화물진행정보 조회 (UNI-PASS)</a>
          <br />
          화물관리번호가 있다면 환율 설정 아래 &lsquo;해외 배송 통관조회&rsquo;에서 바로 진행 단계를 볼 수 있습니다.
          <br />
          실제 절차·수수료는 특송업체와 세관 판단에 따라 다를 수 있습니다.
        </p>
      </div>
    </Disclosure>
  );
}
