"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { resendSignupCode, verifySignup, type FormState } from "../../actions";
import AuthTopBar from "../../AuthTopBar";
import styles from "../../auth.module.css";

export default function VerifyForm() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const next = params.get("next") ?? "/mypage";

  const [state, action, pending] = useActionState<FormState, FormData>(verifySignup, {});
  const [resendState, resendAction, resending] = useActionState<FormState, FormData>(
    resendSignupCode,
    {},
  );

  if (!email) {
    return (
      <>
        <AuthTopBar title="이메일 인증" back="/signup" />
        <div className={styles.body}>
          <p className={styles.error}>이메일 정보가 없어요. 회원가입부터 다시 진행해 주세요.</p>
          <Link href="/signup" className={styles.btnFull}>회원가입으로</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthTopBar title="이메일 인증" back="/signup" />
      <div className={styles.body}>
        <div className={styles.emailBox}>
          <b>{email}</b> 으로 인증코드를 보냈어요.
          <br />
          메일에 있는 숫자 코드를 입력해 주세요.
        </div>

        {state.error && <p className={styles.error}>{state.error}</p>}
        {resendState.error && <p className={styles.error}>{resendState.error}</p>}
        {resendState.message && <p className={styles.message}>{resendState.message}</p>}

        <form action={action}>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
          <div className={styles.form}>
            <input
              className={styles.codeInput}
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="인증코드"
              maxLength={8}
              required
              autoFocus
            />
          </div>
          <button className={styles.btnFull} disabled={pending}>
            {pending ? "확인 중…" : "인증 완료"}
          </button>
        </form>

        <p className={styles.hint}>
          메일이 안 보이면 스팸함을 확인해 주세요. 코드는 일정 시간이 지나면 만료됩니다.
        </p>

        <form action={resendAction} className={styles.resendRow}>
          <input type="hidden" name="email" value={email} />
          <button className={styles.textBtn} disabled={resending}>
            {resending ? "보내는 중…" : "인증코드 다시 받기"}
          </button>
        </form>
      </div>
    </>
  );
}
