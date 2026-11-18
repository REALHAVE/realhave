"use client";

import { useActionState } from "react";
import { signup, type FormState } from "../actions";
import AuthTopBar from "../AuthTopBar";
import styles from "../auth.module.css";

export default function SignupPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(signup, {});
  const v = state.values ?? {};

  return (
    <>
      <AuthTopBar title="회원가입" back="/login" />
      <div className={styles.body}>
        {state.error && <p className={styles.error}>{state.error}</p>}

        {/* key: 오류 후 입력값을 다시 채우기 위해 폼을 새로 그림 */}
        <form action={action} key={JSON.stringify(v)}>
          <div className={styles.form}>
            <div>
              <label className={styles.label} htmlFor="email">이메일</label>
              <input id="email" className={styles.input} type="email" name="email"
                autoComplete="email" defaultValue={v.email} required />
            </div>
            <div>
              <label className={styles.label} htmlFor="password">비밀번호</label>
              <input id="password" className={styles.input} type="password" name="password"
                placeholder="영문+숫자 8자 이상" autoComplete="new-password" minLength={8} required />
            </div>
            <div>
              <label className={styles.label} htmlFor="passwordConfirm">비밀번호 확인</label>
              <input id="passwordConfirm" className={styles.input} type="password"
                name="passwordConfirm" autoComplete="new-password" minLength={8} required />
            </div>
            <div>
              <label className={styles.label} htmlFor="nickname">닉네임</label>
              <input id="nickname" className={styles.input} name="nickname"
                placeholder="2~20자" maxLength={20} defaultValue={v.nickname} required />
            </div>
            <div>
              <label className={styles.label} htmlFor="phone">휴대폰번호</label>
              <input id="phone" className={styles.input} type="tel" name="phone"
                inputMode="numeric" placeholder="010-1234-5678" autoComplete="tel"
                defaultValue={v.phone} required />
            </div>
          </div>

          <label className={styles.agree}>
            <input type="checkbox" name="agree" required />
            이용약관 및 개인정보처리방침에 동의합니다
          </label>

          <button className={styles.btnFull} disabled={pending}>
            {pending ? "처리 중…" : "가입하기"}
          </button>
          <p className={styles.hint}>
            가입하기를 누르면 입력한 이메일로 6자리 인증코드가 발송됩니다.
          </p>
        </form>
      </div>
    </>
  );
}
