import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, type SessionUser } from "./session";

export type AdminRole = "master" | "product" | "cs";
export type AdminUser = SessionUser & { role: AdminRole };

export const ROLE_NAME: Record<AdminRole, string> = {
  master: "전체 관리자",
  product: "상품 관리자",
  cs: "신고·CS 관리자",
};

// 로그인 안 함 → "guest", 로그인했지만 관리자 아님 → "forbidden"
export async function getAdmin(): Promise<AdminUser | "guest" | "forbidden"> {
  const user = await getSessionUser();
  if (!user) return "guest";

  const supabase = await createClient();
  const { data } = await supabase
    .from("admins")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return "forbidden";
  return { ...user, role: data.role as AdminRole };
}

// master는 모든 권한 통과 (DB의 private.is_admin 과 같은 규칙)
export function can(admin: AdminUser, need: AdminRole) {
  return admin.role === "master" || admin.role === need;
}
