// Supabase 접속 정보 (.env.local / Vercel 환경변수에서 읽음)

const URL_PATTERN = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/;
const KEY_PATTERN = /^(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9._-]+)$/;

type Check = "ok" | "missing" | "bad_format" | "secret_key";

// 값 자체는 절대 내보내지 않고, 모양이 맞는지만 알려줌 (/api/health 에서 사용)
export function envDiagnostics() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const urlCheck: Check = !url ? "missing" : URL_PATTERN.test(url) ? "ok" : "bad_format";
  const keyCheck: Check = !key
    ? "missing"
    : key.startsWith("sb_secret_")
      ? "secret_key"
      : KEY_PATTERN.test(key)
        ? "ok"
        : "bad_format";

  return {
    NEXT_PUBLIC_SUPABASE_URL: urlCheck,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: keyCheck,
    // 형식이 틀렸을 때 흔한 실수 힌트 (값은 노출하지 않음)
    hints: [
      ...(url && /\s|"|'/.test(url) ? ["URL에 공백이나 따옴표가 들어 있음"] : []),
      ...(url && url.includes("=") ? ["URL 값에 '이름=' 부분까지 들어 있음"] : []),
      ...(url && !url.startsWith("https://") ? ["URL이 https:// 로 시작하지 않음"] : []),
      ...(key && /\s|"|'/.test(key) ? ["키에 공백이나 따옴표가 들어 있음"] : []),
      ...(key && key.includes("=") && !key.startsWith("eyJ") ? ["키 값에 '이름=' 부분까지 들어 있음"] : []),
    ],
  };
}

export function supabaseEnv() {
  const diag = envDiagnostics();
  if (
    diag.NEXT_PUBLIC_SUPABASE_URL !== "ok" ||
    diag.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== "ok"
  ) {
    throw new Error(
      "Supabase 환경변수가 없거나 형식이 틀렸습니다: " + JSON.stringify(diag),
    );
  }
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string,
  };
}
