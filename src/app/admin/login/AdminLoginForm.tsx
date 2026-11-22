"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { login, type FormState } from "@/app/(app)/(auth)/actions";
import styles from "../admin.module.css";

// 관리자도 리얼해브 회원 계정(이메일)으로 로그인. 관리자 권한은 DB의 admins 표로 확인
export default function AdminLoginForm() {
  const next = useSearchParams().get("next") ?? "/admin";
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});

  return (
    <div className={styles.loginWrap}>
      <form className={styles.loginCard} action={action} key={state.values?.email ?? ""}>
        <div className={styles.loginLogo}>
          Real<span>HAVE</span> Admin
        </div>
        {state.error && <p className={styles.error}>{state.error}</p>}
        <input type="hidden" name="next" value={next.startsWith("/admin") ? next : "/admin"} />
        <input className={styles.loginInput} type="email" name="email" placeholder="관리자 이메일"
          autoComplete="email" defaultValue={state.values?.email} required />
        <input className={styles.loginInput} type="password" name="password" placeholder="비밀번호"
          autoComplete="current-password" required />
        <button className={`${styles.btn} ${styles.primary} ${styles.full}`} disabled={pending}>
          {pending ? "로그인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}
