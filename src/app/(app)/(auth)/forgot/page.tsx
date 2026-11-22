"use client";

import { useActionState } from "react";
import { resetPassword, sendResetCode, type FormState } from "../actions";
import AuthTopBar from "../AuthTopBar";
import styles from "../auth.module.css";

export default function ForgotPage() {
  const [sendState, sendAction, sending] = useActionState<FormState, FormData>(
    sendResetCode,
    {},
  );
  const [resetState, resetAction, resetting] = useActionState<FormState, FormData>(
    resetPassword,
    {},
  );

  const sentEmail = sendState.values?.sent === "1" ? sendState.values.email : "";

  return (
    <>
      <AuthTopBar title="비밀번호 찾기" back="/login" />
      <div className={styles.body}>
        {sendState.error && <p className={styles.error}>{sendState.error}</p>}
        {sendState.message && <p className={styles.message}>{sendState.message}</p>}

        {/* ① 인증코드 받기 */}
        <form action={sendAction} key={sendState.values?.email ?? ""}>
          <div className={styles.form}>
            <input
              className={styles.input}
              type="email"
              name="email"
              placeholder="가입한 이메일 주소"
              autoComplete="email"
              defaultValue={sendState.values?.email}
              required
            />
          </div>
          <button className={styles.btnOutline} disabled={sending} style={{ marginBottom: 20 }}>
            {sending ? "보내는 중…" : sentEmail ? "인증코드 다시 받기" : "인증코드 받기"}
          </button>
        </form>

        {/* ② 코드 + 새 비밀번호 */}
        {sentEmail && (
          <form action={resetAction}>
            <input type="hidden" name="email" value={sentEmail} />
            {resetState.error && <p className={styles.error}>{resetState.error}</p>}
            <div className={styles.form}>
              <input
                className={styles.codeInput}
                name="token"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="인증코드"
                maxLength={8}
                required
              />
              <input
                className={styles.input}
                type="password"
                name="password"
                placeholder="새 비밀번호 (영문+숫자 8자 이상)"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <input
                className={styles.input}
                type="password"
                name="passwordConfirm"
                placeholder="새 비밀번호 확인"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <button className={styles.btnFull} disabled={resetting}>
              {resetting ? "변경 중…" : "확인"}
            </button>
          </form>
        )}

        <p className={styles.hint}>이메일로 받은 인증코드를 입력해주세요.</p>
      </div>
    </>
  );
}
