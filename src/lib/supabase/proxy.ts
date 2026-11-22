import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "./env";

// 로그인해야 들어갈 수 있는 주소 (앞부분 일치)
const PROTECTED_PREFIXES = [
  "/sell",
  "/wishlist",
  "/chat",
  "/sales",
  "/purchases",
  "/withdraw",
];

// 모든 요청마다: 로그인 쿠키 갱신 + 보호된 주소면 로그인 화면으로 보냄
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  // 환경변수가 빠지거나 틀려도 사이트 전체가 멈추지 않게 (로그인 기능만 동작 안 함)
  // 실제 데이터 보호는 DB의 RLS가 담당하므로 여기서 통과시켜도 정보는 새지 않음
  try {
    return await refreshAndGuard(request, response);
  } catch (e) {
    console.error("[proxy] 로그인 확인 실패:", e);
    return response;
  }
}

async function refreshAndGuard(request: NextRequest, initial: NextResponse) {
  let response = initial;
  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // 이 호출이 만료된 로그인 정보를 갱신함 (지우지 말 것)
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);

  const path = request.nextUrl.pathname;
  const needsLogin = PROTECTED_PREFIXES.some(
    (p) => path === p || path.startsWith(p + "/"),
  );

  if (needsLogin && !isLoggedIn) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", path + request.nextUrl.search);
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}
