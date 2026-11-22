import "server-only";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------
// 화면에서 쓰는 상품·브랜드·카테고리 조회 (모두 RLS가 적용된 일반 권한으로 조회)
// ---------------------------------------------------------------------

export type ProductCard = {
  id: string;
  seller_id: string;
  title: string;
  price: number;
  condition_grade: string;
  size: string | null;
  status: "on_sale" | "sold" | "deleted";
  auth_status: "pending" | "approved" | "rejected";
  bumped_at: string;
  is_new: boolean;
  brand_id: string;
  brand_name: string;
  category_id: string;
  category_name: string;
  top_category_id: string;
  top_category_name: string;
  purchase_place_name: string;
  thumb_path: string | null;
};

export type Brand = {
  id: string;
  name_en: string;
  name_ko: string | null;
  origin_country: string | null;
  index_letter: string;
  logo_path: string | null;
};

export type Category = {
  id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
};

const CARD_COLUMNS =
  "id, seller_id, title, price, condition_grade, size, status, auth_status, bumped_at, is_new, " +
  "brand_id, brand_name, category_id, category_name, top_category_id, top_category_name, " +
  "purchase_place_name, thumb_path";

export const LIST_LIMIT = 60;

// 홈 "인기브랜드" (관리자가 정한 순서)
export async function getPopularBrands(): Promise<Brand[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("id, name_en, name_ko, origin_country, index_letter, logo_path")
    .eq("is_active", true)
    .eq("is_popular", true)
    .order("popular_order", { ascending: true, nullsFirst: false })
    .limit(9);
  return data ?? [];
}

// A-Z 전체 브랜드
export async function getAllBrands(): Promise<Brand[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("id, name_en, name_ko, origin_country, index_letter, logo_path")
    .eq("is_active", true)
    .order("index_letter")
    .order("name_en");
  return data ?? [];
}

export async function getBrand(id: string): Promise<Brand | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("brands")
    .select("id, name_en, name_ko, origin_country, index_letter, logo_path")
    .eq("id", id)
    .maybeSingle();
  return data;
}

// 카테고리 (대분류 + 소분류)
export async function getCategoryTree() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, parent_id, name, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  const all = (data ?? []) as Category[];
  return all
    .filter((c) => !c.parent_id)
    .map((top) => ({ ...top, children: all.filter((c) => c.parent_id === top.id) }));
}

export async function getCategory(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, parent_id, name, parent:categories!parent_id(name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const parent = Array.isArray(data.parent) ? data.parent[0] : data.parent;
  return {
    id: data.id as string,
    isTop: !data.parent_id,
    name: data.name as string,
    fullName: parent ? `${parent.name} > ${data.name}` : (data.name as string),
  };
}

// 공개 목록: 정품인증 승인 + 판매중 상품만, 최신순(끌어올리기 반영)
type ListFilter = {
  categoryId?: string;
  brandId?: string;
  query?: string;
  limit?: number;
};

export async function listProducts(filter: ListFilter = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("product_cards")
    .select(CARD_COLUMNS, { count: "exact" })
    .eq("auth_status", "approved")
    .eq("status", "on_sale");

  if (filter.categoryId) {
    // .or() 안에 값을 넣으므로 uuid 형식만 허용 (필터 조작 방지)
    if (!isUuid(filter.categoryId)) return { items: [], count: 0 };
    q = q.or(`category_id.eq.${filter.categoryId},top_category_id.eq.${filter.categoryId}`);
  }
  if (filter.brandId) q = q.eq("brand_id", filter.brandId);
  if (filter.query) {
    // 띄어쓰기로 나눈 단어가 모두 들어간 상품 (예: "에르메스 버킨백")
    const words = filter.query.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
    for (const w of words) q = q.ilike("search_text", `%${w.replace(/[\\%_]/g, "\\$&")}%`);
  }

  const { data, count, error } = await q
    .order("bumped_at", { ascending: false })
    .limit(filter.limit ?? LIST_LIMIT);

  if (error) console.error("[listProducts]", error.message);
  return { items: (data ?? []) as unknown as ProductCard[], count: count ?? 0 };
}

// 상품 상세
export async function getProductDetail(id: string) {
  const supabase = await createClient();

  const [card, extra, images, colors, trades] = await Promise.all([
    supabase.from("product_cards").select(CARD_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("products").select("description").eq("id", id).maybeSingle(),
    supabase
      .from("product_images")
      .select("storage_path, sort_order")
      .eq("product_id", id)
      .order("sort_order"),
    supabase.from("product_colors").select("colors(name, sort_order)").eq("product_id", id),
    supabase
      .from("product_trade_methods")
      .select("trade_methods(name, sort_order)")
      .eq("product_id", id),
  ]);

  if (!card.data) return null;

  type Named = { name: string; sort_order: number };
  const pick = (rows: unknown[] | null, key: string) =>
    ((rows ?? []) as Record<string, Named | Named[] | null>[])
      .map((r) => {
        const v = r[key];
        return Array.isArray(v) ? v[0] : v;
      })
      .filter((v): v is Named => Boolean(v))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => v.name);

  return {
    ...(card.data as unknown as ProductCard),
    description: (extra.data?.description as string | undefined) ?? "",
    images: (images.data ?? []).map((i) => i.storage_path as string),
    colors: pick(colors.data, "colors"),
    tradeMethods: pick(trades.data, "trade_methods"),
  };
}

export { productImageUrl } from "./catalog-url";

// uuid 형식 검사 (주소창에 이상한 값이 들어와도 DB 오류가 나지 않게)
export function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}
