"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

export type ReviewState = { error?: string };

// 승인/반려 (권한·상태 검사는 DB 함수 review_product 가 함)
export async function reviewProduct(_: ReviewState, form: FormData): Promise<ReviewState> {
  const id = String(form.get("productId") ?? "");
  const decision = String(form.get("decision") ?? "");
  const reason = String(form.get("reason") ?? "").trim();

  if (!isUuid(id) || (decision !== "approve" && decision !== "reject"))
    return { error: "잘못된 요청입니다." };
  if (decision === "reject" && !reason) return { error: "반려 사유를 입력해주세요." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_product", {
    p_product_id: id,
    p_approve: decision === "approve",
    p_reason: decision === "reject" ? reason : null,
  });

  if (error) {
    console.error("[review_product]", error);
    return {
      error: /[가-힣]/.test(error.message) ? error.message : "처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
    };
  }

  revalidatePath("/admin/products");
  redirect(`/admin/products?done=${decision}`);
}

export async function adminLogout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// =====================================================================
// 10단계 관리자 기능. 권한은 DB(함수·RLS)가 확인하고, 여기서는 입력값만 검사
// =====================================================================
export type AdminState = { error?: string; message?: string };

function friendly(message: string, fallback: string) {
  if (/row-level security|permission denied/i.test(message)) return "권한이 없어요.";
  if (/duplicate key/i.test(message)) return "이미 같은 이름이 있어요.";
  return /[가-힣]/.test(message) ? message : fallback;
}

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// ---------- 회원: 자격중지 / 허용 ----------
export async function setMemberStatus(_: AdminState, form: FormData): Promise<AdminState> {
  const id = s(form, "userId");
  const suspend = s(form, "suspend") === "1";
  const reason = s(form, "reason");
  if (!isUuid(id)) return { error: "잘못된 요청입니다." };
  if (suspend && !reason) return { error: "자격중지 사유를 입력해주세요." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_member_status", {
    p_user_id: id,
    p_suspend: suspend,
    p_reason: suspend ? reason : null,
  });
  if (error) return { error: friendly(error.message, "바꾸지 못했어요.") };
  revalidatePath("/admin/members");
  return { message: suspend ? "자격을 중지했어요." : "자격을 허용했어요." };
}

// ---------- 신고 처리 ----------
export async function handleReport(_: AdminState, form: FormData): Promise<AdminState> {
  const id = s(form, "reportId");
  const status = s(form, "status");
  const note = s(form, "note").slice(0, 1000);
  if (!isUuid(id) || !["open", "resolved", "dismissed"].includes(status)) return { error: "잘못된 요청입니다." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ status, admin_note: note || null })
    .eq("id", id);
  if (error) return { error: friendly(error.message, "저장하지 못했어요.") };
  revalidatePath("/admin/reports");
  return { message: "저장했어요." };
}

// ---------- 1:1 문의 답변 ----------
export async function answerInquiry(_: AdminState, form: FormData): Promise<AdminState> {
  const id = s(form, "inquiryId");
  const answer = s(form, "answer").slice(0, 3000);
  if (!isUuid(id)) return { error: "잘못된 요청입니다." };
  const supabase = await createClient();
  const { error } = await supabase.from("inquiries").update({ answer: answer || null }).eq("id", id);
  if (error) return { error: friendly(error.message, "저장하지 못했어요.") };
  revalidatePath("/admin/reports");
  return { message: answer ? "답변을 등록했어요." : "답변을 지웠어요." };
}

// ---------- 공지/이벤트 ----------
export async function saveNotice(_: AdminState, form: FormData): Promise<AdminState> {
  const id = s(form, "id");
  const kind = s(form, "kind") === "event" ? "event" : "notice";
  const title = s(form, "title");
  const body = String(form.get("body") ?? "").slice(0, 20000);
  const publish = form.get("publish") === "on";
  if (!title || title.length > 100) return { error: "제목을 1~100자로 입력해주세요." };
  if (id && !isUuid(id)) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const row = { kind, title, body, is_published: publish };
  const { error } = id
    ? await supabase.from("notices").update(row).eq("id", id)
    : await supabase.from("notices").insert(row);
  if (error) return { error: friendly(error.message, "저장하지 못했어요.") };
  revalidatePath("/admin/notices");
  revalidatePath("/notices");
  redirect("/admin/notices?saved=1");
}

export async function deleteNotice(id: string): Promise<AdminState> {
  if (!isUuid(id)) return { error: "잘못된 요청입니다." };
  const supabase = await createClient();
  const { error } = await supabase.from("notices").delete().eq("id", id);
  if (error) return { error: friendly(error.message, "삭제하지 못했어요.") };
  revalidatePath("/admin/notices");
  redirect("/admin/notices?deleted=1");
}

// ---------- 관리자 계정 ----------
export async function setAdmin(_: AdminState, form: FormData): Promise<AdminState> {
  const email = s(form, "email").toLowerCase();
  const role = s(form, "role");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "이메일을 확인해주세요." };
  if (!["master", "product", "cs"].includes(role)) return { error: "권한을 선택해주세요." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_admin", { p_email: email, p_role: role });
  if (error) return { error: friendly(error.message, "지정하지 못했어요.") };
  revalidatePath("/admin/settings");
  return { message: "관리자로 지정했어요." };
}

export async function removeAdmin(userId: string): Promise<AdminState> {
  if (!isUuid(userId)) return { error: "잘못된 요청입니다." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_remove_admin", { p_user_id: userId });
  if (error) return { error: friendly(error.message, "해제하지 못했어요.") };
  revalidatePath("/admin/settings");
  return { message: "관리자에서 해제했어요." };
}

// ---------- 브랜드 ----------
export async function saveBrand(_: AdminState, form: FormData): Promise<AdminState> {
  const id = s(form, "id");
  const nameEn = s(form, "name_en").toUpperCase();
  const nameKo = s(form, "name_ko");
  const origin = s(form, "origin_country");
  const popular = form.get("is_popular") === "on";
  const order = Number(s(form, "popular_order")) || null;
  if (!nameEn || nameEn.length > 50) return { error: "영문 브랜드명을 1~50자로 입력해주세요." };
  if (id && !isUuid(id)) return { error: "잘못된 요청입니다." };

  const supabase = await createClient();
  const row = {
    name_en: nameEn,
    name_ko: nameKo || null,
    origin_country: origin || null,
    is_popular: popular,
    popular_order: popular ? order : null,
  };
  const { error } = id
    ? await supabase.from("brands").update(row).eq("id", id)
    : await supabase.from("brands").insert(row);
  if (error) return { error: friendly(error.message, "저장하지 못했어요.") };
  revalidatePath("/admin/catalog");
  revalidatePath("/");
  return { message: id ? "브랜드를 수정했어요." : "브랜드를 추가했어요." };
}

// ---------- 카테고리 ----------
export async function saveCategory(_: AdminState, form: FormData): Promise<AdminState> {
  const id = s(form, "id");
  const parentId = s(form, "parent_id");
  const name = s(form, "name");
  const sizeType = s(form, "size_type") || "none";
  if (!name || name.length > 30) return { error: "카테고리 이름을 1~30자로 입력해주세요." };
  if ((id && !isUuid(id)) || (parentId && !isUuid(parentId))) return { error: "잘못된 요청입니다." };
  if (!["none", "clothing", "shoes", "kids"].includes(sizeType)) return { error: "사이즈 종류를 확인해주세요." };

  const supabase = await createClient();
  const { error } = id
    ? await supabase
        .from("categories")
        .update(parentId ? { name } : { name, size_type: sizeType })
        .eq("id", id)
    : await supabase.from("categories").insert({
        name,
        parent_id: parentId || null,
        size_type: parentId ? "none" : sizeType, // 소분류는 대분류를 따라감 (DB 트리거)
        sort_order: 999,
      });
  if (error) return { error: friendly(error.message, "저장하지 못했어요.") };
  revalidatePath("/admin/catalog");
  revalidatePath("/category");
  return { message: id ? "카테고리를 수정했어요." : "카테고리를 추가했어요." };
}

// 숨김/보이기 (상품이 연결돼 있을 수 있어 삭제 대신 숨김)
export async function toggleCatalogActive(kind: "brand" | "category", id: string, active: boolean): Promise<AdminState> {
  if (!isUuid(id)) return { error: "잘못된 요청입니다." };
  const supabase = await createClient();
  const { error } = await supabase
    .from(kind === "brand" ? "brands" : "categories")
    .update({ is_active: active })
    .eq("id", id);
  if (error) return { error: friendly(error.message, "바꾸지 못했어요.") };
  revalidatePath("/admin/catalog");
  revalidatePath("/");
  revalidatePath("/category");
  revalidatePath("/designers");
  return { message: active ? "다시 보이게 했어요." : "숨겼어요. (회원 화면에서 안 보임)" };
}

// ---------- 회원 삭제 (전체 관리자) ----------
//  신고 처리 중인 대화는 증거로 보관한 뒤 삭제 (결정 15). 되돌릴 수 없음
export async function deleteMember(_: AdminState, form: FormData): Promise<AdminState> {
  const id = s(form, "userId");
  const confirmText = s(form, "confirm");
  if (!isUuid(id)) return { error: "잘못된 요청입니다." };
  if (confirmText !== "삭제") return { error: "확인 칸에 '삭제'라고 입력해주세요." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_member", { p_user_id: id });
  if (error) return { error: friendly(error.message, "삭제하지 못했어요.") };
  revalidatePath("/admin/members");
  return { message: "회원을 삭제했어요." };
}
