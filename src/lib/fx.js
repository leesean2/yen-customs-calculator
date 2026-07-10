/**
 * 다통화 환율 조회 (frankfurter.dev / ECB 일간, 키·CORS 문제 없음).
 * - useExchangeRates는 JPY·USD 실시간(장중)을 담당하고, 여기서는 그 외 통화(EUR·CNY)의
 *   최신 환율과, 모든 통화의 '추이 그래프'용 시계열을 가져온다. 관세 계산에 일간이면 충분하다.
 * 반환 환율은 모두 '원/1단위'(KRW per 1 unit of currency).
 */
import { timeoutSignal } from "./net.js";

const HOST = "https://api.frankfurter.dev/v1";
const iso = (d) => d.toISOString().slice(0, 10);

/** 최신 원/1단위 환율. currency: "USD"|"EUR"|"CNY"|"JPY" 등 */
export async function fetchKrwPerUnit(currency, signal) {
  const res = await fetch(`${HOST}/latest?base=${currency}&symbols=KRW`, {
    signal: signal ?? timeoutSignal(10_000),
  });
  if (!res.ok) throw new Error(`환율 조회 실패 (HTTP ${res.status})`);
  const data = await res.json();
  const v = data?.rates?.KRW;
  if (!v) throw new Error("환율 응답 형식 오류");
  return { krwPerUnit: v, date: data.date ?? null };
}

/** 최근 days일 원/1단위 시계열 [{ date, rate }] (날짜 오름차순).
 *  ECB는 영업일만 고시하므로 주말·공휴일은 비어 있다 — 있는 날만 반환한다. */
export async function fetchKrwSeries(currency, days, signal) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const res = await fetch(`${HOST}/${iso(start)}..${iso(end)}?base=${currency}&symbols=KRW`, {
    signal: signal ?? timeoutSignal(12_000),
  });
  if (!res.ok) throw new Error(`추이 조회 실패 (HTTP ${res.status})`);
  const data = await res.json();
  const rates = data?.rates || {};
  const points = Object.keys(rates)
    .sort()
    .map((date) => ({ date, rate: rates[date]?.KRW }))
    .filter((p) => p.rate);
  if (!points.length) throw new Error("추이 데이터가 없습니다");
  return points;
}
