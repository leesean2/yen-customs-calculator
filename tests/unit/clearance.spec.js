import { describe, it, expect } from "vitest";
import { clearanceGuide } from "../../src/lib/clearance.js";

/* 통관 절차 안내 분기 단위 테스트 — 판정(면세/과세·배제)에 따라
   경로와 단계 구성이 계산 결과와 어긋나지 않는지 검증한다 */

const guide = (over = {}) =>
  clearanceGuide({ taxed: false, hasExcluded: false, deMinimisUsd: 150, taxText: "28,202원", ...over });

describe("clearanceGuide — 경로 분기", () => {
  it("면세면 목록통관 3단계 — 세액 납부 단계가 없다", () => {
    const g = guide();
    expect(g.route).toBe("목록통관");
    expect(g.steps).toHaveLength(3);
    expect(g.steps.map((s) => s.title).join()).not.toContain("세액");
    expect(g.steps[1].desc).toContain("150달러 이하");
  });

  it("과세(한도 초과)면 일반 수입신고 4단계 — 예상 세액이 납부 단계에 들어간다", () => {
    const g = guide({ taxed: true });
    expect(g.route).toBe("일반 수입신고");
    expect(g.steps).toHaveLength(4);
    expect(g.steps[1].desc).toContain("150달러를 넘어");
    expect(g.steps[2].title).toContain("납부");
    expect(g.steps[2].desc).toContain("28,202원");
  });

  it("목록통관 배제 품목이면 신고 사유가 금액이 아닌 품목으로 안내된다", () => {
    const g = guide({ taxed: true, hasExcluded: true });
    expect(g.route).toBe("일반 수입신고");
    expect(g.steps[1].desc).toContain("목록통관 배제 품목");
    expect(g.steps[1].desc).not.toContain("달러를 넘어");
  });

  it("출발국 면세한도가 문구에 반영된다 — 미국 $200", () => {
    expect(guide({ deMinimisUsd: 200 }).steps[1].desc).toContain("200달러 이하");
    expect(guide({ taxed: true, deMinimisUsd: 200 }).steps[1].desc).toContain("200달러를 넘어");
  });
});
