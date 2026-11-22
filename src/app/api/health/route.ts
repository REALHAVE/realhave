import { connection } from "next/server";
import { envDiagnostics } from "@/lib/supabase/env";

// 배포 사이트 설정 점검용: 환경변수가 "있는지/모양이 맞는지"만 알려줌 (값은 절대 안 보여줌)
export async function GET() {
  await connection(); // 요청 때마다 새로 확인
  return Response.json({ supabase: envDiagnostics() });
}
