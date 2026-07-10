import { useCallback, useMemo, useState } from "react";
import { loadOrders, saveOrders, newOrderId, todayStr } from "../lib/orders.js";

/**
 * 구매 이력 + 합산과세 판정 훅
 * 같은 날 + 같은 판매자(대소문자 무시) 기록을 찾아, 현재 입력 중인 주문과의
 * 합산 물품가격을 달러로 환산해 면세한도 초과 여부를 계산한다.
 *
 * 통화 일반화: goodsJpy·jpyKrw는 '출발국 통화' 금액과 그 원화 환율이다(엔이 기본).
 * 합산은 같은 출발국(country) 기록끼리만 한다 — 통화가 섞이면 단일 환율로 환산할 수
 * 없고, 같은 판매자는 실질적으로 같은 출발국이다. country 없는 기존 기록은 일본 취급.
 */
export default function useOrders({ seller, goodsJpy, jpyKrw, usdKrw, limitUsd, country = "JP" }) {
  const [orders, setOrders] = useState(loadOrders);

  const add = useCallback((order) => {
    setOrders((prev) => {
      const next = [{ id: newOrderId(), ...order }, ...prev];
      saveOrders(next);
      return next;
    });
  }, []);

  const remove = useCallback((id) => {
    setOrders((prev) => {
      const next = prev.filter((o) => o.id !== id);
      saveOrders(next);
      return next;
    });
  }, []);

  const sellerTrim = seller.trim();
  const dupes = useMemo(() => {
    if (!sellerTrim) return [];
    const today = todayStr();
    return orders.filter(
      (o) =>
        o.date === today &&
        o.seller.toLowerCase() === sellerTrim.toLowerCase() &&
        (o.country ?? "JP") === country
    );
  }, [orders, sellerTrim, country]);

  const dupSumJpy = dupes.reduce((sum, o) => sum + o.goodsJpy, 0);
  const combinedUsd = usdKrw ? ((dupSumJpy + goodsJpy) * jpyKrw) / usdKrw : NaN;
  const combinedOver = combinedUsd > limitUsd;

  return { orders, add, remove, sellerTrim, dupes, dupSumJpy, combinedUsd, combinedOver };
}
