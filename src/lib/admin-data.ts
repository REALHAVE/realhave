import "server-only";
import { getProductDetail, type ProductCard } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

// 관리자 화면용 조회. 관리자 권한은 DB(RLS)가 다시 한 번 확인함

const CARD_COLUMNS =
  "id, seller_id, title, price, condition_grade, size, status, auth_status, bumped_at, is_new, created_at, " +
  "brand_id, brand_name, category_id, category_name, top_category_id, top_category_name, " +
  "purchase_place_name, thumb_path, view_count, sold_at";

export type AdminProductRow = ProductCard & { created_at: string; seller_nickname: string };

async function withNicknames(rows: (ProductCard & { created_at: string })[]) {
  const supabase = await createClient();
  const ids = [...new Set(rows.map((r) => r.seller_id))];
  const { data } = ids.length
    ? await supabase.from("profiles").select("id, nickname").in("id", ids)
    : { data: [] };
  const names = new Map((data ?? []).map((p) => [p.id as string, p.nickname as string]));
  return rows.map((r) => ({ ...r, seller_nickname: names.get(r.seller_id) ?? "(알 수 없음)" }));
}

// 심사대기: 오래 기다린 순
export async function listPendingProducts(): Promise<AdminProductRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_cards")
    .select(CARD_COLUMNS)
    .eq("auth_status", "pending")
    .eq("status", "on_sale")
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) console.error("[listPendingProducts]", error.message);
  return withNicknames((data ?? []) as unknown as (ProductCard & { created_at: string })[]);
}

export async function countPending() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("auth_status", "pending")
    .eq("status", "on_sale");
  return count ?? 0;
}

// 전체 상품: 최근 등록 순
export async function listAllProducts(): Promise<AdminProductRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_cards")
    .select(CARD_COLUMNS)
    .neq("status", "deleted")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) console.error("[listAllProducts]", error.message);
  return withNicknames((data ?? []) as unknown as (ProductCard & { created_at: string })[]);
}

const KIND_NAME: Record<string, string> = { tag: "한글택", invoice: "인보이스", receipt: "구매영수증" };

// 심사 화면: 상품 정보 + 인증서류 원본(10분짜리 임시 링크) + 판매자 + 심사 이력
export async function getReviewDetail(id: string) {
  const product = await getProductDetail(id);
  if (!product) return null;

  const supabase = await createClient();
  const [certs, seller, reviews] = await Promise.all([
    supabase
      .from("product_cert_images")
      .select("kind, storage_path, created_at")
      .eq("product_id", id)
      .order("created_at"),
    supabase.from("profiles").select("nickname, status, created_at").eq("id", product.seller_id).maybeSingle(),
    supabase
      .from("auth_reviews")
      .select("id, method, status, reject_reason, created_at, decided_at, reviewer:profiles!reviewer_id(nickname)")
      .eq("product_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const certRows = certs.data ?? [];
  const signed = certRows.length
    ? await supabase.storage.from("cert-docs").createSignedUrls(
        certRows.map((c) => c.storage_path as string),
        600,
      )
    : { data: [] };

  return {
    product,
    certs: certRows.map((c, i) => ({
      kind: KIND_NAME[c.kind as string] ?? (c.kind as string),
      url: signed.data?.[i]?.signedUrl ?? null,
    })),
    seller: seller.data as { nickname: string; status: string; created_at: string } | null,
    reviews: (reviews.data ?? []).map((r) => {
      const reviewer = Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer;
      return {
        id: r.id as string,
        status: r.status as string,
        reason: r.reject_reason as string | null,
        createdAt: r.created_at as string,
        decidedAt: r.decided_at as string | null,
        reviewer: (reviewer as { nickname: string } | null)?.nickname ?? null,
      };
    }),
  };
}

// 판매자에게 보여줄 최근 반려 사유
export async function getLatestRejectReason(productId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("auth_reviews")
    .select("reject_reason")
    .eq("product_id", productId)
    .eq("status", "rejected")
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.reject_reason as string | undefined) ?? null;
}

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

// =====================================================================
// 10단계: 대시보드 · 회원 · 거래 · 신고/CS · 공지 · 카테고리/브랜드 · 관리자
// (권한 확인은 DB 함수·RLS가 함. 권한이 없으면 빈 값)
// =====================================================================

export type Dashboard = {
  today_products: number;
  today_signups: number;
  pending: number;
  pending_over24: number;
  open_reports: number;
  waiting_inquiries: number;
  members: number;
  on_sale: number;
  weekly: { day: string; count: number }[];
  recent_deals: {
    product: string;
    buyer: string | null;
    seller: string;
    method: string | null;
    price: number;
    completed_at: string;
  }[];
};

export async function getDashboard(): Promise<Dashboard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_dashboard");
  if (error) console.error("[admin_dashboard]", error.message);
  return (data as Dashboard) ?? null;
}

export type MemberRow = {
  id: string;
  nickname: string;
  email: string;
  phone: string | null;
  status: "active" | "suspended";
  suspended_reason: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
  on_sale_count: number;
  sold_count: number;
  purchase_count: number;
  admin_role: "master" | "product" | "cs" | null;
};

export async function listMembers(query?: string): Promise<MemberRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_members", { p_query: query ?? null });
  if (error) console.error("[admin_members]", error.message);
  return (data ?? []) as MemberRow[];
}

export type DealRow = {
  room_id: string | null;
  product_id: string;
  product: string;
  price: number;
  buyer: string | null;
  seller: string;
  last_message_at: string | null;
  state: "chatting" | "done" | "done_other" | "done_no_buyer" | "closed";
  method: string | null;
  reported: boolean;
};

export async function listDeals(): Promise<DealRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_deal_overview");
  if (error) console.error("[admin_deal_overview]", error.message);
  return (data ?? []) as DealRow[];
}

export type ReportRow = {
  id: string;
  target_type: "product" | "user" | "chat";
  reason: "fake_suspect" | "false_listing" | "no_response" | "bad_manner" | "etc";
  detail: string | null;
  status: "open" | "resolved" | "dismissed";
  admin_note: string | null;
  result_message: string | null;
  created_at: string;
  handled_at: string | null;
  reporter: string;
  target_user: string | null;
  target_user_id: string | null;
  product_id: string | null;
  product: string | null;
  room_id: string | null;
  evidence: Evidence | null;
  evidence_room_id: string | null;
};

// 회원탈퇴 때 보관한 대화 사본 (결정 15)
export type Evidence = {
  saved_at: string;
  withdrawn_user: string | null;
  product: { title: string; brand: string; price: number; seller: string } | null;
  target_user: string | null;
  messages: { sender: string | null; is_seller: boolean; body: string | null; image_path: string | null; created_at: string }[];
};

// 보관된 대화의 사진 임시 링크 (CS 관리자만 — 저장소 규칙)
export async function evidenceImageUrls(paths: string[]) {
  if (paths.length === 0) return new Map<string, string>();
  const supabase = await createClient();
  const { data } = await supabase.storage.from("chat-images").createSignedUrls(paths, 600);
  return new Map<string, string>((data ?? []).map((s) => [s.path ?? "", s.signedUrl ?? ""]));
}

export const REPORT_REASON: Record<ReportRow["reason"], string> = {
  fake_suspect: "정품 의심",
  false_listing: "허위매물",
  no_response: "응답 없음",
  bad_manner: "비매너",
  etc: "기타",
};

export const REPORT_TARGET: Record<ReportRow["target_type"], string> = {
  product: "상품",
  user: "회원",
  chat: "채팅",
};

export async function listReports(): Promise<ReportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_reports");
  if (error) console.error("[admin_reports]", error.message);
  return (data ?? []) as ReportRow[];
}

// 신고된 채팅방의 대화 (CS는 신고된 방만 볼 수 있음 — RLS)
export async function getReportedChat(roomId: string) {
  const supabase = await createClient();
  const [{ data: room }, { data: msgs }] = await Promise.all([
    supabase.from("chat_rooms").select("seller_id, buyer_id").eq("id", roomId).maybeSingle(),
    supabase
      .from("messages")
      .select("id, sender_id, body, image_path, created_at")
      .eq("room_id", roomId)
      .order("created_at")
      .limit(500),
  ]);
  if (!room) return null;
  const { data: people } = await supabase
    .from("profiles")
    .select("id, nickname")
    .in("id", [room.seller_id, room.buyer_id]);
  const names = new Map((people ?? []).map((p) => [p.id as string, p.nickname as string]));
  const list = (msgs ?? []) as { id: string; sender_id: string; body: string | null; image_path: string | null; created_at: string }[];
  const paths = list.filter((m) => m.image_path).map((m) => m.image_path as string);
  const signed = paths.length
    ? (await supabase.storage.from("chat-images").createSignedUrls(paths, 600)).data ?? []
    : [];
  const urls = new Map(signed.map((s) => [s.path, s.signedUrl]));
  return {
    sellerId: room.seller_id as string,
    messages: list.map((m) => ({
      ...m,
      sender: names.get(m.sender_id) ?? "(알 수 없음)",
      isSeller: m.sender_id === room.seller_id,
      imageUrl: m.image_path ? urls.get(m.image_path) ?? null : null,
    })),
  };
}

export type InquiryRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  status: "waiting" | "answered";
  answer: string | null;
  answered_at: string | null;
  created_at: string;
  writer: string;
};

export async function listInquiries(): Promise<InquiryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inquiries")
    .select("id, user_id, title, body, status, answer, answered_at, created_at, writer:profiles!user_id(nickname)")
    .order("status", { ascending: true }) // waiting(답변대기)이 먼저 (enum 정의 순서)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) console.error("[inquiries]", error.message);
  return (data ?? []).map((r) => {
    const w = Array.isArray(r.writer) ? r.writer[0] : r.writer;
    return { ...(r as unknown as InquiryRow), writer: (w as { nickname: string } | null)?.nickname ?? "(알 수 없음)" };
  });
}

export type NoticeRow = {
  id: string;
  kind: "notice" | "event";
  title: string;
  body: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
};

export async function listNoticesAdmin(): Promise<NoticeRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notices")
    .select("id, kind, title, body, is_published, published_at, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) console.error("[notices]", error.message);
  return (data ?? []) as NoticeRow[];
}

export async function getNoticeAdmin(id: string): Promise<NoticeRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notices")
    .select("id, kind, title, body, is_published, published_at, created_at")
    .eq("id", id)
    .maybeSingle();
  return (data as NoticeRow) ?? null;
}

export type AdminAccount = {
  user_id: string;
  nickname: string;
  email: string;
  role: "master" | "product" | "cs";
  last_sign_in_at: string | null;
  created_at: string;
};

export async function listAdmins(): Promise<AdminAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_admins");
  if (error) console.error("[admin_list_admins]", error.message);
  return (data ?? []) as AdminAccount[];
}

// 카테고리·브랜드 관리 (숨긴 것까지 전부)
export async function getCatalogAdmin() {
  const supabase = await createClient();
  const [cats, brands, counts] = await Promise.all([
    supabase
      .from("categories")
      .select("id, parent_id, name, size_type, sort_order, is_active")
      .order("sort_order"),
    supabase
      .from("brands")
      .select("id, name_en, name_ko, origin_country, index_letter, is_popular, popular_order, is_active")
      .order("index_letter")
      .order("name_en"),
    supabase.rpc("admin_catalog_counts"),
  ]);
  const countMap = new Map<string, number>();
  for (const c of (counts.data ?? []) as { kind: string; id: string; cnt: number }[]) {
    countMap.set(`${c.kind}:${c.id}`, (countMap.get(`${c.kind}:${c.id}`) ?? 0) + c.cnt);
  }
  type Cat = { id: string; parent_id: string | null; name: string; size_type: string; sort_order: number; is_active: boolean };
  const all = (cats.data ?? []) as Cat[];
  return {
    categories: all
      .filter((c) => !c.parent_id)
      .map((t) => ({
        ...t,
        count: countMap.get(`category:${t.id}`) ?? 0,
        children: all
          .filter((c) => c.parent_id === t.id)
          .map((c) => ({ ...c, count: countMap.get(`category:${c.id}`) ?? 0 })),
      })),
    brands: ((brands.data ?? []) as {
      id: string; name_en: string; name_ko: string | null; origin_country: string | null;
      index_letter: string; is_popular: boolean; popular_order: number | null; is_active: boolean;
    }[]).map((b) => ({ ...b, count: countMap.get(`brand:${b.id}`) ?? 0 })),
  };
}

// 관리자 1:1 대화 목록 (CS)
export type AdminThreadRow = {
  thread_id: string;
  user_id: string;
  nickname: string;
  subject: string;
  report_id: string | null;
  last_message_at: string | null;
  last_message: string | null;
  unread: number;
};

export async function listSupportThreads(): Promise<AdminThreadRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_support_threads");
  if (error) console.error("[admin_support_threads]", error.message);
  return (data ?? []) as AdminThreadRow[];
}

// 법정 보관함 (전자상거래법 제6조) — 전체 관리자만
export type LegalRecord = {
  id: string;
  kind: "contract" | "dispute" | "ad";
  subject_name: string | null;
  source_table: string;
  data: Record<string, unknown>;
  recorded_at: string;
  retain_until: string;
  reason: string;
  expired: boolean;
};

export async function listLegalRecords(kind?: LegalRecord["kind"]): Promise<LegalRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_legal_records", { p_kind: kind ?? null });
  if (error) console.error("[admin_legal_records]", error.message);
  return (data ?? []) as LegalRecord[];
}
