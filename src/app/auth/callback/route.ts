import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

// 소셜 로그인(카카오·Apple·Google)에서 돌아오는 주소.
// 받은 코드로 로그인을 완료하고, 처음 가입이면 추가 정보 입력 화면으로 보냄
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"), "/");

  const fail = () => NextResponse.redirect(new URL("/login?error=social", url.origin));
  if (!code) return fail();

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback]", error.message);
    return fail();
  }

  // 휴대폰번호·약관 동의가 아직 없으면 추가 정보 입력 (결정 7: 휴대폰 필수)
  const { data } = await supabase.rpc("my_profile_status");
  const status = (Array.isArray(data) ? data[0] : data) as { needs_onboarding: boolean } | null;
  if (status?.needs_onboarding) {
    return NextResponse.redirect(
      new URL(`/signup/complete?next=${encodeURIComponent(next)}`, url.origin),
    );
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
