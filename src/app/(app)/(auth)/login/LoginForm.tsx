"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { login, type FormState } from "../actions";
import styles from "../auth.module.css";
import SocialButtons from "./SocialButtons";

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
      {params.get("error") === "social" && !state.error && (
        <p className={styles.error}>소셜 로그인을 마치지 못했어요. 다시 시도하거나 이메일로 로그인해 주세요.</p>
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
      <SocialButtons next={next} />

      <p className={styles.foot}>
        아직 회원이 아니신가요? <Link href="/signup">회원가입</Link>
      </p>
    </div>
  );
}
