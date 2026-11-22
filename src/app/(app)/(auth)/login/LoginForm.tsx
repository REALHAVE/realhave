"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { login, type FormState } from "../actions";
import styles from "../auth.module.css";

export default function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});

  return (
    <div className={styles.wrap}>
      <Link href="/" className={styles.logo}>
        <span className={styles.rAccent}>R</span>eal HAVE
      </Link>

      {next !== "/" && !state.error && (
        <p className={styles.message}>로그인이 필요한 메뉴예요. 로그인 후 이동합니다.</p>
      )}
      {state.error && <p className={styles.error}>{state.error}</p>}

      <form action={action} key={state.values?.email ?? ""}>
        <input type="hidden" name="next" value={next} />
        <div className={styles.form}>
          <input
            className={styles.input}
            type="email"
            name="email"
            placeholder="이메일"
            autoComplete="email"
            defaultValue={state.values?.email}
            required
          />
          <input
            className={styles.input}
            type="password"
            name="password"
            placeholder="비밀번호"
            autoComplete="current-password"
            required
          />
        </div>
        <Link href="/forgot" className={styles.link}>
          비밀번호를 잊으셨나요?
        </Link>
        <button className={styles.btnFull} disabled={pending}>
          {pending ? "로그인 중…" : "로그인"}
        </button>
      </form>

      <div className={styles.divider}>또는</div>
      <div className={styles.social}>
        {/* 소셜 로그인은 12단계에서 연결 */}
        <div className={styles.soc}>카카오로 시작하기 (준비 중)</div>
        <div className={styles.soc}>Apple로 시작하기 (준비 중)</div>
        <div className={styles.soc}>Google로 시작하기 (준비 중)</div>
      </div>

      <p className={styles.foot}>
        아직 회원이 아니신가요? <Link href="/signup">회원가입</Link>
      </p>
    </div>
  );
}
