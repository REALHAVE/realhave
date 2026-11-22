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
