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

// 채팅 시간 표시: 오늘이면 "오후 2:14", 어제면 "어제", 그 전이면 "11월 20일"
export function chatTimeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const kst = (x: Date) => new Date(x.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
  const today = kst(now);
  const yesterday = kst(new Date(now.getTime() - 86400_000));
  const day = kst(d);
  if (day === today) return timeOfDay(iso);
  if (day === yesterday) return "어제";
  return `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`;
}

export function timeOfDay(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
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
