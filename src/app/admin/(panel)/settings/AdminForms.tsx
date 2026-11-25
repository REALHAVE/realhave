"use client";

import { useActionState, useState, useTransition } from "react";
import { removeAdmin, setAdmin, type AdminState } from "../../actions";
import styles from "../../admin.module.css";

export function AddAdminForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(setAdmin, {});
  return (
    <form action={action}>
      <div className={styles.formRow}>
        <input className={`${styles.field} ${styles.fieldWide}`} type="email" name="email"
          placeholder="회원가입한 이메일" required />
        <select className={styles.field} name="role" defaultValue="product">
          <option value="product">상품 관리자</option>
          <option value="cs">신고·CS 관리자</option>
          <option value="master">전체 관리자</option>
        </select>
        <button className={`${styles.btn} ${styles.primary}`} disabled={pending}>
          {pending ? "처리 중…" : "지정"}
        </button>
      </div>
      {state.error && <p className={styles.inlineErr}>{state.error}</p>}
      {state.message && <p className={styles.inlineMsg}>{state.message}</p>}
    </form>
  );
}

export function RemoveAdminButton({ userId, nickname }: { userId: string; nickname: string }) {
  const [ask, setAsk] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminState>({});

  if (!ask) {
    return (
      <button type="button" className={`${styles.btn} ${styles.small} ${styles.ghost}`} onClick={() => setAsk(true)}>
        해제
      </button>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12 }}>
      {nickname}님 해제?
      <button type="button" className={`${styles.btn} ${styles.small} ${styles.ghost}`} onClick={() => setAsk(false)}>
        취소
      </button>
      <button type="button" className={`${styles.btn} ${styles.small} ${styles.reject}`} disabled={pending}
        onClick={() => start(async () => setResult(await removeAdmin(userId)))}>
        해제
      </button>
      {result.error && <span className={styles.inlineErr}>{result.error}</span>}
    </span>
  );
}
