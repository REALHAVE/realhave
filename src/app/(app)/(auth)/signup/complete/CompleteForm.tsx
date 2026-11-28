"use client";

import { useActionState } from "react";
import { completeProfile, type FormState } from "../../actions";
import styles from "../../auth.module.css";

export default function CompleteForm({ nickname, next }: { nickname: string; next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(completeProfile, {});
  const v = state.values ?? {};
  return (
    <div className={styles.body}>
      <p className={styles.message}>
        가입을 거의 마쳤어요! 리얼해브에서 거래하려면 아래 정보가 필요해요.
      </p>
      {state.error && <p className={styles.error}>{state.error}</p>}
      <form action={action} key={JSON.stringify(v)}>
        <input type="hidden" name="next" value={next} />
        <div className={styles.form}>
          <div>
            <label className={styles.label} htmlFor="nickname">닉네임</label>
            <input id="nickname" className={styles.input} name="nickname" maxLength={20} required
              defaultValue={v.nickname ?? nickname} placeholder="2~20자" />
          </div>
          <div>
            <label className={styles.label} htmlFor="phone">휴대폰번호</label>
            <input id="phone" className={styles.input} type="tel" name="phone" inputMode="numeric"
              autoComplete="tel" required defaultValue={v.phone} placeholder="010-1234-5678" />
          </div>
        </div>
        <label className={styles.agree}>
          <input type="checkbox" name="agree" required />
          이용약관 및 개인정보처리방침에 동의합니다
        </label>
        <button className={styles.btnFull} disabled={pending}>
          {pending ? "저장 중…" : "가입 완료"}
        </button>
      </form>
    </div>
  );
}
