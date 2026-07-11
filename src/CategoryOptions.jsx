import { CATEGORIES } from "./data/categories.js";

/* 품목 셀렉트의 <option> 목록 (직구·직구여행·국내비교 탭 공용)
   라벨에 관세율을 병기해, 품목을 고르는 순간 세율 차이가 보이게 한다 */
export default function CategoryOptions() {
  return CATEGORIES.map((c) => (
    <option key={c.id} value={c.id}>
      {c.label} — 관세 {Math.round(c.duty * 100)}%
    </option>
  ));
}
