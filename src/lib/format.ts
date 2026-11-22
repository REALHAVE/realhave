export function formatPrice(won: number) {
  return `${won.toLocaleString("ko-KR")}원`;
}

export function sizeLabel(size: string | null) {
  return size ?? "사이즈 없음";
}

// "3시간 전" 같은 표시
export function sinceLabel(iso: string) {
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return "방금 전";
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return `${Math.floor(sec / 86400)}일 전`;
}

// 끌어올리기까지 남은 시간(시간 단위, 0이면 지금 가능). DB 규칙: 상품별 24시간 1회
export function bumpWaitHours(bumpedAt: string) {
  const left = new Date(bumpedAt).getTime() + 24 * 3600_000 - Date.now();
  return left > 0 ? Math.ceil(left / 3600_000) : 0;
}

// 카드에 쓰는 상태 표시: 새상품이면 NEW, 아니면 USED · 등급
export function conditionLabel(grade: string) {
  return grade === "NEW" ? "NEW · 새상품" : `USED · ${grade}`;
}
