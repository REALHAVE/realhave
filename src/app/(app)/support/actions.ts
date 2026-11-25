"use server";

import { redirect } from "next/navigation";
import { isUuid } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string };

function friendly(message: string, fallback: string) {
  if (/row-level security/i.test(message)) return "지금은 이용할 수 없어요. (이용이 제한된 계정일 수 있어요)";
  return /[가-힣]/.test(message) ? message : fallback;
}

// 1:1 문의 작성
export async function createInquiry(_: FormState, form: FormData): Promise<FormState> {
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  if (!title || title.length > 100) return { error: "제목을 1~100자로 입력해주세요." };
  if (!body || body.length > 3000) return { error: "내용을 1~3000자로 입력해주세요." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) redirect("/login?next=/support/new");

  const { error } = await supabase.from("inquiries").insert({ user_id: uid, title, body });
  if (error) return { error: friendly(error.message, "문의를 보내지 못했어요.") };
  redirect("/support?sent=1");
}

// 신고하기 (상품 / 채팅). 대상 회원·상품은 DB가 자동으로 채움
export async function createReport(_: FormState, form: FormData): Promise<FormState> {
  const kind = String(form.get("kind") ?? "");
  const id = String(form.get("targetId") ?? "");
  const reason = String(form.get("reason") ?? "");
  const detail = String(form.get("detail") ?? "").trim().slice(0, 1000);
  if (!["product", "chat"].includes(kind) || !isUuid(id)) return { error: "잘못된 요청입니다." };
  if (!["fake_suspect", "false_listing", "no_response", "bad_manner", "etc"].includes(reason))
    return { error: "신고 사유를 선택해주세요." };
  if (reason === "etc" && !detail) return { error: "기타 사유를 적어주세요." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) redirect("/login");

  const { error } = await supabase.from("reports").insert({
    reporter_id: uid,
    target_type: kind,
    target_product_id: kind === "product" ? id : null,
    target_room_id: kind === "chat" ? id : null,
    reason,
    detail: detail || null,
  });
  if (error) return { error: friendly(error.message, "신고하지 못했어요.") };
  redirect(`/report/done?back=${encodeURIComponent(kind === "product" ? `/products/${id}` : `/chat/${id}`)}`);
}
