/**
 * 품목별 관세율 (2026-07 기준, 참고용)
 * duty: 관세율, luxury: 개별소비세 대상(가방·시계),
 * excluded: 목록통관 배제 품목, vatExempt: 부가세 면제
 */
export const CATEGORIES = [
  { id: "electronics", label: "전자기기 (폰·노트북·태블릿·카메라)", duty: 0, note: "ITA 협정 품목은 관세 0%, 부가세 10%만 부과됩니다." },
  { id: "clothing", label: "의류 · 신발", duty: 0.13 },
  { id: "bag", label: "가방 · 시계", duty: 0.08, luxury: true, note: "과세가격 200만원 초과분에는 개별소비세 20% + 교육세가 추가됩니다." },
  { id: "cosmetics", label: "화장품 · 향수", duty: 0.08 },
  { id: "audio", label: "이어폰 · 음향기기", duty: 0.08 },
  { id: "hobby", label: "피규어 · 게임 · 취미용품", duty: 0.08 },
  { id: "health", label: "건강기능식품 · 영양제", duty: 0.08, excluded: true, note: "목록통관 배제 품목 — 150달러 이하여도 수입신고 대상이라 과세될 수 있습니다. 자가사용 인정 수량(총 6병)도 확인하세요." },
  { id: "book", label: "서적 · 음반", duty: 0, vatExempt: true, note: "서적류는 관세 0%, 부가가치세도 면제됩니다." },
  { id: "etc", label: "기타 일반물품", duty: 0.08 },
];

export const DUTY_FREE_LIMIT_USD = 150;   // 일본발 직구 소액면세 한도
export const TRAVELER_LIMIT_USD = 800;    // 여행자 휴대품 기본 면세한도
export const LUXURY_SCT_BASE = 2_000_000; // 개별소비세 기준(가방·시계)
