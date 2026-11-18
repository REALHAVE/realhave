// 회원가입·로그인 입력값 검사 (화면과 서버에서 같은 규칙 사용)

export const PASSWORD_MIN = 8;

export function normalizePhone(raw: string) {
  return raw.replace(/[^0-9]/g, "");
}

export function isValidPhone(digits: string) {
  return /^01[016789][0-9]{7,8}$/.test(digits);
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidNickname(nick: string) {
  return nick.length >= 2 && nick.length <= 20;
}

// 비밀번호: 8자 이상, 영문과 숫자 포함
export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `비밀번호는 ${PASSWORD_MIN}자 이상이어야 해요.`;
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw))
    return "비밀번호에 영문과 숫자를 모두 넣어주세요.";
  return null;
}

// 로그인 후 돌아갈 주소: 우리 사이트 안의 주소만 허용 (외부 사이트로 보내기 방지)
export function safeNext(next: unknown, fallback = "/") {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\"))
    return fallback;
  return next;
}

// Supabase 오류 → 한국어 안내
export function authErrorMessage(code: string | undefined, fallback: string) {
  switch (code) {
    case "invalid_credentials":
      return "이메일 또는 비밀번호가 맞지 않아요.";
    case "email_not_confirmed":
      return "이메일 인증이 아직 완료되지 않았어요.";
    case "user_already_exists":
    case "email_exists":
      return "이미 가입된 이메일이에요. 로그인해 주세요.";
    case "otp_expired":
      return "인증코드가 틀렸거나 만료되었어요. 코드를 다시 받아주세요.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
    case "weak_password":
      return "비밀번호가 너무 쉬워요. 더 복잡하게 만들어 주세요.";
    case "same_password":
      return "이전과 다른 비밀번호를 입력해 주세요.";
    case "validation_failed":
      return "입력값을 다시 확인해 주세요.";
    default:
      return fallback;
  }
}
