export function formatPrice(won: number) {
  return `${won.toLocaleString("ko-KR")}원`;
}

export function sizeLabel(size: string | null) {
  return size ?? "사이즈 없음";
}

// 카드에 쓰는 상태 표시: 새상품이면 NEW, 아니면 USED · 등급
export function conditionLabel(grade: string) {
  return grade === "NEW" ? "NEW · 새상품" : `USED · ${grade}`;
}
