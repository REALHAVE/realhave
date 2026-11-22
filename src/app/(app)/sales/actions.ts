"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string; message?: string };

// DB가 보낸 한글 안내는 그대로, 나머지는 일반 안내
function friendly(message: string, fallback: string) {
  return /[가-힣]/.test(message) ? message : fallback;
}

export async function bumpProduct(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { error: "잘못된 요청입니다." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("bump_product", { p_product_id: id });
  if (error) return { error: friendly(error.message, "끌어올리지 못했어요.") };
  revalidatePath("/sales");
  revalidatePath("/");
  return { message: "끌어올렸어요! 최신등록상품 맨 앞에 보여요." };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { error: "잘못된 요청입니다." };
  const supabase = await createClient();
  // 실제로 지우지 않고 '삭제됨'으로 표시 (거래 기록 보존). 규칙은 DB 트리거가 확인
  const { error } = await supabase.from("products").update({ status: "deleted" }).eq("id", id);
  if (error) return { error: friendly(error.message, "삭제하지 못했어요.") };
  revalidatePath("/sales");
  revalidatePath("/");
  return { message: "삭제했어요." };
}

export async function relistProduct(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return { error: "잘못된 요청입니다." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("relist_product", { p_product_id: id });
  if (error) return { error: friendly(error.message, "재등록하지 못했어요.") };
  // 복사된 새 글의 수정 화면으로 (가격 등 고친 뒤 저장)
  redirect(`/sales/${data as string}/edit?relisted=1`);
}

export async function completeDeal(_: ActionResult, form: FormData): Promise<ActionResult> {
  const id = String(form.get("productId") ?? "");
  if (!isUuid(id)) return { error: "잘못된 요청입니다." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_deal", { p_product_id: id, p_buyer_id: null });
  if (error) return { error: friendly(error.message, "거래완료로 바꾸지 못했어요.") };
  revalidatePath("/sales");
  redirect("/sales?tab=done&completed=1");
}
