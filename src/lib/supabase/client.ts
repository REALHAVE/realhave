import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

// 브라우저에서 쓰는 Supabase 연결 (사진 업로드 등). 로그인 정보는 쿠키에서 읽음
let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!client) {
    const { url, key } = supabaseEnv();
    client = createBrowserClient(url, key);
  }
  return client;
}
