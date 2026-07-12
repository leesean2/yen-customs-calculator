import { describe, it, expect } from "vitest";
import { percentileRank, percentileVerdict, percentileText } from "../../src/lib/percentile.js";

describe("percentileRank — 중간 순위 방식", () => {
  it("분포 하단·상단·중간", () => {
    const vs = [10, 20, 30, 40, 50];
    expect(percentileRank(vs, 10)).toBeCloseTo(10); // 아래 0 + 동률 0.5 / 5
    expect(percentileRank(vs, 50)).toBeCloseTo(90);
    expect(percentileRank(vs, 30)).toBeCloseTo(50);
    expect(percentileRank(vs, 5)).toBe(0);   // 분포보다 낮음
    expect(percentileRank(vs, 99)).toBe(100); // 분포보다 높음
  });

  it("동률이 여러 개면 중간 순위 — 한쪽으로 쏠리지 않는다", () => {
    expect(percentileRank([10, 10, 10, 10], 10)).toBe(50);
  });

  it("비수치는 무시, 빈 분포·비수치 현재값은 NaN", () => {
    expect(percentileRank([10, NaN, 30], 30)).toBeCloseTo(75); // 유효 2개 중 아래 1 + 동률 0.5
    expect(percentileRank([], 10)).toBeNaN();
    expect(percentileRank([1, 2], NaN)).toBeNaN();
  });
});

describe("percentileVerdict / percentileText — 문구 경계", () => {
  it("구간 경계값 판정", () => {
    expect(percentileVerdict(20)).toEqual({ text: "매우 싼 구간입니다", tone: "good" });
    expect(percentileVerdict(20.1).text).toBe("싼 편입니다");
    expect(percentileVerdict(40).tone).toBe("good");
    expect(percentileVerdict(50)).toEqual({ text: "중간 수준입니다", tone: "neutral" });
    expect(percentileVerdict(60).tone).toBe("bad");
    expect(percentileVerdict(80).text).toBe("매우 비싼 구간입니다");
    expect(percentileVerdict(NaN)).toBeNull();
  });

  it("50% 이하는 하위, 초과는 상위로 표기한다", () => {
    expect(percentileText(12.4)).toBe("하위 12%");
    expect(percentileText(50)).toBe("하위 50%");
    expect(percentileText(88)).toBe("상위 12%");
  });
});
