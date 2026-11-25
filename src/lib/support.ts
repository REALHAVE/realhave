import "server-only";
import { isUuid } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------
// 공지사항 (누구나, 게시중인 글만 — RLS)
// ---------------------------------------------------------------------
export type Notice = {
  id: string;
  kind: "notice" | "event";
  title: string;
  body: string;
  published_at: string | null;
  created_at: string;
};

export async function listNotices(): Promise<Notice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notices")
    .select("id, kind, title, body, published_at, created_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(100);
  if (error) console.error("[notices]", error.message);
  return (data ?? []) as Notice[];
}

export async function getNotice(id: string): Promise<Notice | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("notices")
    .select("id, kind, title, body, published_at, created_at")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();
  return (data as Notice) ?? null;
}

// ---------------------------------------------------------------------
// 1:1 문의 (본인 글만 — RLS)
// ---------------------------------------------------------------------
export type Inquiry = {
  id: string;
  title: string;
  body: string;
  status: "waiting" | "answered";
  answer: string | null;
  answered_at: string | null;
  created_at: string;
};

export async function listMyInquiries(userId: string): Promise<Inquiry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inquiries")
    .select("id, title, body, status, answer, answered_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) console.error("[my inquiries]", error.message);
  return (data ?? []) as Inquiry[];
}

export async function getMyInquiry(id: string, userId: string): Promise<Inquiry | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("inquiries")
    .select("id, title, body, status, answer, answered_at, created_at")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Inquiry) ?? null;
}

// ---------------------------------------------------------------------
// 신고하기: 대상 확인
// ---------------------------------------------------------------------
export const REPORT_REASONS = [
  { code: "fake_suspect", name: "정품 의심" },
  { code: "false_listing", name: "허위매물" },
  { code: "no_response", name: "응답 없음" },
  { code: "bad_manner", name: "비매너" },
  { code: "etc", name: "기타" },
] as const;

// 신고 화면 위쪽에 보여줄 대상 이름 (볼 수 있는 상품·참여한 채팅만 — RLS)
export async function getReportTarget(kind: "product" | "chat", id: string, userId: string) {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  if (kind === "product") {
    const { data } = await supabase
      .from("product_cards")
      .select("id, title, brand_name, seller_id")
      .eq("id", id)
      .maybeSingle();
    if (!data || data.seller_id === userId) return null;
    return { kind, id, label: `${data.brand_name} ${data.title}` };
  }
  const { data: room } = await supabase
    .from("chat_rooms")
    .select("id, seller_id, buyer_id")
    .eq("id", id)
    .maybeSingle();
  if (!room) return null;
  const otherId = room.seller_id === userId ? room.buyer_id : room.seller_id;
  const { data: other } = await supabase.from("profiles").select("nickname").eq("id", otherId).maybeSingle();
  return { kind, id, label: `${other?.nickname ?? "상대방"}님과의 대화` };
}
