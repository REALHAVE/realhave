import "server-only";
import { isUuid, type ProductCard } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------
// 찜
// ---------------------------------------------------------------------
export async function isWished(productId: string, userId: string | undefined) {
  if (!userId) return false;
  const supabase = await createClient();
  const { count } = await supabase
    .from("wishlists")
    .select("product_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("product_id", productId);
  return (count ?? 0) > 0;
}

export async function countWishlist(userId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("wishlists")
    .select("product_id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}

// 찜한 상품 (최근 찜한 순). 비공개로 바뀐 상품은 RLS가 빼줌
export async function listWishlist(userId: string): Promise<ProductCard[]> {
  const supabase = await createClient();
  const { data: wish } = await supabase
    .from("wishlists")
    .select("product_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  const ids = (wish ?? []).map((w) => w.product_id as string);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from("product_cards")
    .select(
      "id, seller_id, title, price, condition_grade, size, status, auth_status, bumped_at, is_new, " +
        "brand_id, brand_name, category_id, category_name, top_category_id, top_category_name, " +
        "purchase_place_name, thumb_path, view_count, sold_at",
    )
    .in("id", ids)
    .neq("status", "deleted");
  const rows = (data ?? []) as unknown as ProductCard[];
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

// ---------------------------------------------------------------------
// 채팅
// ---------------------------------------------------------------------
export type ChatRoomRow = {
  room_id: string;
  product_id: string;
  product_title: string;
  brand_name: string;
  product_price: number;
  product_status: "on_sale" | "sold" | "deleted";
  thumb_path: string | null;
  i_am_seller: boolean;
  other_id: string;
  other_nickname: string;
  last_message_at: string;
  last_message: string | null;
  unread: number;
};

export async function getMyRooms(): Promise<ChatRoomRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_chat_rooms");
  if (error) console.error("[my_chat_rooms]", error.message);
  return (data ?? []) as ChatRoomRow[];
}

export async function getUnreadTotal(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_unread_total");
  if (error) return 0;
  return (data as number) ?? 0;
}

export type ChatMessage = {
  id: string;
  sender_id: string;
  body: string | null;
  image_path: string | null;
  created_at: string;
  image_url?: string | null;
};

// 채팅방 한 개 (당사자만 — RLS)
export async function getRoom(roomId: string, userId: string) {
  if (!isUuid(roomId)) return null;
  const supabase = await createClient();

  const { data: room } = await supabase
    .from("chat_rooms")
    .select("id, product_id, seller_id, buyer_id")
    .eq("id", roomId)
    .maybeSingle();
  if (!room || (room.seller_id !== userId && room.buyer_id !== userId)) return null;

  const otherId = room.seller_id === userId ? room.buyer_id : room.seller_id;
  const [other, product, thumb, msgs] = await Promise.all([
    supabase.from("profiles").select("nickname").eq("id", otherId).maybeSingle(),
    supabase.rpc("my_chat_rooms"),
    supabase
      .from("product_images")
      .select("storage_path")
      .eq("product_id", room.product_id)
      .order("sort_order")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("id, sender_id, body, image_path, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  // 상품 요약은 내 채팅 목록 함수에서 (상품이 비공개로 바뀌어도 이름은 보이게)
  const info = ((product.data ?? []) as ChatRoomRow[]).find((r) => r.room_id === roomId);

  const messages = ((msgs.data ?? []) as ChatMessage[]).reverse();
  const imagePaths = messages.filter((m) => m.image_path).map((m) => m.image_path as string);
  if (imagePaths.length) {
    const { data: signed } = await supabase.storage.from("chat-images").createSignedUrls(imagePaths, 3600);
    const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    for (const m of messages) if (m.image_path) m.image_url = urls.get(m.image_path) ?? null;
  }

  return {
    id: room.id as string,
    productId: room.product_id as string,
    iAmSeller: room.seller_id === userId,
    otherNickname: (other.data?.nickname as string | undefined) ?? "(알 수 없음)",
    product: info
      ? {
          title: info.product_title,
          brand: info.brand_name,
          price: info.product_price,
          status: info.product_status,
          thumb: (thumb.data?.storage_path as string | undefined) ?? info.thumb_path,
        }
      : null,
    messages,
  };
}

// ---------------------------------------------------------------------
// 구매내역 / 거래완료 구매자 후보
// ---------------------------------------------------------------------

// 이 상품으로 나와 대화한 구매희망자들 (거래완료 때 구매자 후보)
export async function getBuyerCandidates(productId: string) {
  const rooms = await getMyRooms();
  return rooms
    .filter((r) => r.product_id === productId && r.i_am_seller)
    .map((r) => ({
      buyerId: r.other_id,
      nickname: r.other_nickname,
      lastMessage: r.last_message,
      lastAt: r.last_message_at,
    }));
}

export type Purchase = {
  productId: string;
  title: string;
  brand: string;
  price: number;
  thumb: string | null;
  sellerNickname: string;
  completedAt: string;
  roomId: string | null;
};

// 내가 구매자로 선택된 거래 (최근 순)
export async function listPurchases(userId: string): Promise<Purchase[]> {
  const supabase = await createClient();
  const { data: deals } = await supabase
    .from("deals")
    .select("product_id, seller_id, price, completed_at")
    .eq("buyer_id", userId)
    .order("completed_at", { ascending: false })
    .limit(200);
  const rows = (deals ?? []) as { product_id: string; seller_id: string; price: number; completed_at: string }[];
  if (rows.length === 0) return [];

  const productIds = rows.map((d) => d.product_id);
  const sellerIds = [...new Set(rows.map((d) => d.seller_id))];
  const [cards, sellers, rooms] = await Promise.all([
    supabase
      .from("product_cards")
      .select("id, title, brand_name, thumb_path")
      .in("id", productIds),
    supabase.from("profiles").select("id, nickname").in("id", sellerIds),
    supabase.from("chat_rooms").select("id, product_id").eq("buyer_id", userId).in("product_id", productIds),
  ]);

  const cardMap = new Map(
    ((cards.data ?? []) as { id: string; title: string; brand_name: string; thumb_path: string | null }[]).map(
      (c) => [c.id, c],
    ),
  );
  const nameMap = new Map((sellers.data ?? []).map((s) => [s.id as string, s.nickname as string]));
  const roomMap = new Map((rooms.data ?? []).map((r) => [r.product_id as string, r.id as string]));

  return rows.map((d) => {
    const c = cardMap.get(d.product_id);
    return {
      productId: d.product_id,
      title: c?.title ?? "(판매자가 삭제한 상품)",
      brand: c?.brand_name ?? "",
      price: d.price,
      thumb: c?.thumb_path ?? null,
      sellerNickname: nameMap.get(d.seller_id) ?? "(알 수 없음)",
      completedAt: d.completed_at,
      roomId: roomMap.get(d.product_id) ?? null,
    };
  });
}

export async function countPurchases(userId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("buyer_id", userId);
  return count ?? 0;
}

// 이 상품을 내가 샀는지 (상품 상세 하단 표시용)
export async function didIBuy(productId: string, userId: string | undefined) {
  if (!userId) return false;
  const supabase = await createClient();
  const { count } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("buyer_id", userId);
  return (count ?? 0) > 0;
}

// ---------------------------------------------------------------------
// 채팅방 신고 안내 (신고자 본인에게만 — 신고자만 자기 신고를 읽을 수 있음)
// ---------------------------------------------------------------------
export type MyRoomReport = {
  status: "open" | "resolved" | "dismissed";
  result_message: string | null;
  created_at: string;
  handled_at: string | null;
};

export async function getMyRoomReport(roomId: string, userId: string): Promise<MyRoomReport | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("status, result_message, created_at, handled_at")
    .eq("target_room_id", roomId)
    .eq("reporter_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as MyRoomReport) ?? null;
}

// ---------------------------------------------------------------------
// 관리자 1:1 대화 (회원 쪽)
// ---------------------------------------------------------------------
export type SupportThreadRow = {
  thread_id: string;
  subject: string;
  last_message_at: string;
  last_message: string | null;
  unread: number;
};

export async function getMySupportThreads(): Promise<SupportThreadRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_support_threads");
  if (error) return [];
  return (data ?? []) as SupportThreadRow[];
}

export type SupportMessage = {
  id: string;
  sender_id: string | null;
  is_admin: boolean;
  body: string;
  created_at: string;
};

// 대화방 한 개 (회원 본인 또는 CS 관리자 — RLS)
export async function getSupportThread(threadId: string) {
  if (!isUuid(threadId)) return null;
  const supabase = await createClient();
  const { data: t } = await supabase
    .from("support_threads")
    .select("id, user_id, subject, report_id, user:profiles!user_id(nickname)")
    .eq("id", threadId)
    .maybeSingle();
  if (!t) return null;
  const { data: msgs } = await supabase
    .from("support_messages")
    .select("id, sender_id, is_admin, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(500);
  const user = Array.isArray(t.user) ? t.user[0] : t.user;
  return {
    id: t.id as string,
    userId: t.user_id as string,
    nickname: (user as { nickname: string } | null)?.nickname ?? "(알 수 없음)",
    subject: t.subject as string,
    reportId: (t.report_id as string | null) ?? null,
    messages: (msgs ?? []) as SupportMessage[],
  };
}
