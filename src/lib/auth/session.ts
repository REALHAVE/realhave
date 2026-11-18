import "server-only";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string | null;
  nickname: string;
  status: "active" | "suspended";
};

// 현재 로그인한 회원 (없으면 null). 화면에서는 반드시 <Suspense> 안에서 호출
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, status")
    .eq("id", claims.sub)
    .maybeSingle();

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    nickname: profile?.nickname ?? "회원",
    status: profile?.status ?? "active",
  };
}
