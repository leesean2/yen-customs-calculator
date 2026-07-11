import { getCountry } from "../data/countries.js";
import useOriginRate from "./useOriginRate.js";

/**
 * 출발국 환율 해석 훅 (직구 탭·직구여행 비교 탭 공용)
 * 우선순위:
 *   1. override — 공유 링크 스냅샷(원/1단위). JPY·USD는 j·u 파라미터가 대신하므로 무시
 *   2. JPY·USD — App 상단 환율 설정(jr·ur, 수동 입력 반영)
 *   3. krwPer[currency] — useExchangeRates 실시간 맵(장중 소스·er-api가 EUR·CNY 포함)
 *   4. useOriginRate — frankfurter(ECB 일간) 직접 조회, 실패 시 localStorage 캐시
 * 반환 status: shared | app | market | idle | loading | live | cached | error
 */
export default function useOriginCountry({ countryId, jr, ur, krwPer, override = null }) {
  const country = getCountry(countryId);
  const isAppCurrency = country.currency === "JPY" || country.currency === "USD";
  const effOverride = isAppCurrency ? null : override;
  const marketRate = (!isAppCurrency && krwPer?.[country.currency]) || 0;
  const fallback = useOriginRate(
    isAppCurrency || effOverride != null || marketRate > 0 ? null : country.currency
  );

  const rate =
    country.currency === "JPY" ? jr
    : country.currency === "USD" ? ur
    : effOverride ?? (marketRate > 0 ? marketRate : fallback.rate);
  const status =
    effOverride != null ? "shared"
    : isAppCurrency ? (rate > 0 ? "app" : "idle")
    : marketRate > 0 ? "market"
    : fallback.status;

  return { country, isAppCurrency, rate, status, date: fallback.date, retry: fallback.retry };
}
