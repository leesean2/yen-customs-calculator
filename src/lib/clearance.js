/**
 * 통관 절차 안내 — 계산 결과(면세/과세·배제 품목 여부)에 맞는 절차를 알려준다.
 * 면세 결과는 '목록통관'(수입신고 생략), 과세·배제 품목은 '일반 수입신고'
 * (신고 → 세액 납부 → 반출) 경로를 탄다. 문구는 계산 결과와 같은 판정
 * 근거(shop.taxed 등)로 분기해, 결과 카드와 안내가 어긋나지 않게 한다.
 */
export const PCCC_URL = "https://unipass.customs.go.kr/csp/persIndex.do"; // 개인통관고유부호 발급·조회
export const CARGO_TRACK_URL = "https://unipass.customs.go.kr/csp/index.do"; // UNI-PASS(화물진행정보 조회)

/**
 * taxed/hasExcluded: calcCartImportCost 결과 그대로 · deMinimisUsd: 출발국 한도
 * taxText: 예상 세액 표기(원) — 포매팅은 호출부(ui.jsx won) 소유
 * 반환: { route, steps: [{ title, desc }] }
 */
export function clearanceGuide({ taxed, hasExcluded, deMinimisUsd, taxText }) {
  const pccc = {
    title: "개인통관고유부호 준비",
    desc: "주문서(배대지 신청서)에 개인통관고유부호(P로 시작하는 13자리)를 입력합니다. 주민등록번호 대신 쓰는 통관용 번호로, 관세청에서 무료로 즉시 발급됩니다.",
  };

  if (!taxed) {
    return {
      route: "목록통관",
      steps: [
        pccc,
        {
          title: "목록통관 — 수입신고 생략",
          desc: `미화 ${deMinimisUsd}달러 이하 자가사용 물품은 특송업체가 제출하는 통관목록만으로 통관됩니다. 별도 신고 절차와 세금이 없습니다.`,
        },
        {
          title: "국내 배송",
          desc: "통관이 끝나면 국내 택배로 전환됩니다. 같은 날 도착한 같은 출발국 주문은 합산될 수 있으니 이 탭의 합산과세 경고를 참고하세요.",
        },
      ],
    };
  }

  return {
    route: "일반 수입신고",
    steps: [
      pccc,
      {
        title: "일반 수입신고",
        desc:
          (hasExcluded
            ? "목록통관 배제 품목(건강기능식품 등)이 있어 금액과 무관하게 수입신고 대상입니다. "
            : `물품가격이 미화 ${deMinimisUsd}달러를 넘어 수입신고 대상입니다. `) +
          "신고는 특송업체·관세사가 대행하며, 업체에 따라 통관 대행 수수료가 추가될 수 있습니다.",
      },
      {
        title: "세액 고지 · 납부",
        desc: `예상 세액 ${taxText} — 특송업체가 대납 후 청구하거나, 세관 고지 후 가상계좌·카드로 직접 납부합니다. 납부 전까지 물품은 보세구역에 머뭅니다.`,
      },
      {
        title: "통관 완료 · 국내 배송",
        desc: "납부가 확인되면 반출되어 국내 택배로 배송됩니다. 진행 상태는 UNI-PASS 화물진행정보에서 운송장번호로 조회할 수 있습니다.",
      },
    ],
  };
}
