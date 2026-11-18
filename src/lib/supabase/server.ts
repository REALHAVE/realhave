import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

// 서버(화면 렌더링·서버 액션)에서 쓰는 Supabase 연결. 로그인 정보는 쿠키로 주고받음
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // 화면 렌더링 중에는 쿠키를 쓸 수 없음 → proxy.ts 가 대신 갱신하므로 무시
        }
      },
    },
  });
}
