import "server-only";
import { getProductDetail, type ProductCard } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

// 관리자 화면용 조회. 관리자 권한은 DB(RLS)가 다시 한 번 확인함

const CARD_COLUMNS =
  "id, seller_id, title, price, condition_grade, size, status, auth_status, bumped_at, is_new, created_at, " +
  "brand_id, brand_name, category_id, category_name, top_category_id, top_category_name, " +
  "purchase_place_name, thumb_path";

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
