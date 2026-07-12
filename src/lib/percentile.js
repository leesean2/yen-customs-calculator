/**
 * 백분위 순위 — "지금 환율이 최근 1년 분포에서 몇 % 지점인가"용.
 * 동률은 중간 순위(mid-rank)로 취급해, 값이 몇 번 반복돼도 순위가
 * 한쪽으로 쏠리지 않는다. 반환은 0~100 (낮을수록 분포 하단 = 싼 편).
 */
export function percentileRank(values, current) {
  const vs = values.filter((v) => Number.isFinite(v));
  if (!vs.length || !Number.isFinite(current)) return NaN;
  let below = 0, equal = 0;
  for (const v of vs) {
    if (v < current) below++;
    else if (v === current) equal++;
  }
  return ((below + equal / 2) / vs.length) * 100;
}

/** 백분위 → 판정 문구·색조. tone은 호출부가 색 토큰으로 해석한다
 *  (환율은 살 사람 기준이라 낮을수록 good). */
export function percentileVerdict(pct) {
  if (isNaN(pct)) return null;
  if (pct <= 20) return { text: "매우 싼 구간입니다", tone: "good" };
  if (pct <= 40) return { text: "싼 편입니다", tone: "good" };
  if (pct < 60) return { text: "중간 수준입니다", tone: "neutral" };
  if (pct < 80) return { text: "비싼 편입니다", tone: "bad" };
  return { text: "매우 비싼 구간입니다", tone: "bad" };
}

/** 표기: 분포 어느 쪽에서 세는 게 직관적인지에 따라 하위/상위를 고른다.
 *  분포 밖 극단값은 "하위 0%"가 아닌 "하위 1%"로 — 0%는 표기로서 어색하다 */
export function percentileText(pct) {
  if (isNaN(pct)) return "";
  const p = Math.round(pct);
  return p <= 50 ? `하위 ${Math.max(p, 1)}%` : `상위 ${Math.max(100 - p, 1)}%`;
}
