import "server-only";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string | null;
  nickname: string;
  status: "active" | "suspended";
  // 소셜로 처음 가입해서 휴대폰번호·약관 동의를 아직 안 한 경우 true → /signup/complete
  needsOnboarding: boolean;
};

// 현재 로그인한 회원 (없으면 null). 화면에서는 반드시 <Suspense> 안에서 호출
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const [{ data: profile }, { data: priv }] = await Promise.all([
    supabase.from("profiles").select("nickname, status").eq("id", claims.sub).maybeSingle(),
    supabase
      .from("user_private")
      .select("phone, terms_agreed_at, privacy_agreed_at")
      .eq("user_id", claims.sub)
      .maybeSingle(),
  ]);

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    nickname: profile?.nickname ?? "회원",
    status: profile?.status ?? "active",
    needsOnboarding: !priv?.phone || !priv?.terms_agreed_at || !priv?.privacy_agreed_at,
  };
}
