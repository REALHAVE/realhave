"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  authErrorMessage,
  isValidEmail,
  isValidNickname,
  isValidPhone,
  normalizePhone,
  passwordProblem,
  safeNext,
} from "@/lib/auth/validation";

export type FormState = {
  error?: string;
  message?: string;
  // 화면에 다시 채워줄 값 (비밀번호는 절대 되돌려주지 않음)
  values?: Record<string, string>;
};

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// ---------------------------------------------------------------------
// 로그인
// ---------------------------------------------------------------------
export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));
  const values = { email };

  if (!isValidEmail(email) || !password)
    return { error: "이메일과 비밀번호를 입력해 주세요.", values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      // 인증 안 된 계정 → 새 코드를 보내고 코드 입력 화면으로
      await supabase.auth.resend({ type: "signup", email });
      redirect(`/signup/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
    }
    return { error: authErrorMessage(error.code, "로그인하지 못했어요. 다시 시도해 주세요."), values };
  }

  redirect(next);
}

// ---------------------------------------------------------------------
// 회원가입 → 이메일로 6자리 코드 발송
// ---------------------------------------------------------------------
export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const passwordConfirm = String(form.get("passwordConfirm") ?? "");
  const nickname = str(form, "nickname");
  const phone = normalizePhone(str(form, "phone"));
  const agreed = form.get("agree") === "on";
  const values = { email, nickname, phone: str(form, "phone") };

  if (!isValidEmail(email)) return { error: "이메일 주소를 확인해 주세요.", values };
  const pwProblem = passwordProblem(password);
  if (pwProblem) return { error: pwProblem, values };
  if (password !== passwordConfirm) return { error: "비밀번호 확인이 일치하지 않아요.", values };
  if (!isValidNickname(nickname)) return { error: "닉네임은 2~20자로 입력해 주세요.", values };
  if (!isValidPhone(phone))
    return { error: "휴대폰번호를 확인해 주세요. (예: 010-1234-5678)", values };
  if (!agreed) return { error: "이용약관 및 개인정보처리방침에 동의해 주세요.", values };

  const supabase = await createClient();

  const { data: available, error: nickError } = await supabase.rpc(
    "is_nickname_available",
    { p_nickname: nickname },
  );
  if (nickError) return { error: "잠시 후 다시 시도해 주세요.", values };
  if (!available) return { error: "이미 사용 중인 닉네임이에요.", values };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nickname, phone, agreed_terms: "true", agreed_privacy: "true" },
    },
  });

  if (error) {
    console.error("[signup]", error.code, error.message);
    if (/sending .*email/i.test(error.message))
      return {
        error: "인증 메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요. (계속되면 고객센터로 문의)",
        values,
      };
    return { error: authErrorMessage(error.code, "가입하지 못했어요. 다시 시도해 주세요."), values };
  }

  // 이미 가입·인증된 이메일이면 Supabase는 오류 대신 빈 정보를 돌려줌
  if (data.user && data.user.identities?.length === 0)
    return { error: "이미 가입된 이메일이에요. 로그인해 주세요.", values };

  redirect(`/signup/verify?email=${encodeURIComponent(email)}`);
}

// ---------------------------------------------------------------------
// 가입 이메일 코드 확인 → 로그인 상태가 됨
// ---------------------------------------------------------------------
export async function verifySignup(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email").toLowerCase();
  const token = str(form, "token").replace(/\s/g, "");
  const next = safeNext(form.get("next"), "/mypage");

  if (!/^[0-9]{6,8}$/.test(token)) return { error: "메일로 받은 인증코드를 입력해 주세요." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { error: authErrorMessage(error.code, "인증코드가 맞지 않아요.") };

  redirect(next);
}

export async function resendSignupCode(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email").toLowerCase();
  if (!isValidEmail(email)) return { error: "이메일 주소가 없어요. 처음부터 다시 가입해 주세요." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) return { error: authErrorMessage(error.code, "코드를 다시 보내지 못했어요.") };
  return { message: "인증코드를 다시 보냈어요. 메일함(스팸함 포함)을 확인해 주세요." };
}

// ---------------------------------------------------------------------
// 비밀번호 찾기: ① 코드 받기  ② 코드 + 새 비밀번호
// ---------------------------------------------------------------------
export async function sendResetCode(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email").toLowerCase();
  if (!isValidEmail(email)) return { error: "가입한 이메일 주소를 입력해 주세요.", values: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error && error.code !== "user_not_found")
    return { error: authErrorMessage(error.code, "코드를 보내지 못했어요."), values: { email } };

  // 가입 여부를 알려주지 않음 (남의 이메일 가입 여부 확인 방지)
  return {
    message: "가입된 이메일이라면 인증코드가 발송됐어요. 메일함(스팸함 포함)을 확인해 주세요.",
    values: { email, sent: "1" },
  };
}

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email").toLowerCase();
  const token = str(form, "token").replace(/\s/g, "");
  const password = String(form.get("password") ?? "");
  const passwordConfirm = String(form.get("passwordConfirm") ?? "");
  const values = { email, sent: "1" };

  if (!/^[0-9]{6,8}$/.test(token)) return { error: "메일로 받은 인증코드를 입력해 주세요.", values };
  const pwProblem = passwordProblem(password);
  if (pwProblem) return { error: pwProblem, values };
  if (password !== passwordConfirm) return { error: "비밀번호 확인이 일치하지 않아요.", values };

  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.verifyOtp({ email, token, type: "recovery" });
  if (otpError) return { error: authErrorMessage(otpError.code, "인증코드가 맞지 않아요."), values };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authErrorMessage(error.code, "비밀번호를 바꾸지 못했어요."), values };

  redirect("/mypage");
}

// ---------------------------------------------------------------------
// 로그아웃
// ---------------------------------------------------------------------
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/mypage");
}
