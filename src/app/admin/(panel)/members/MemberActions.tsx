"use client";

import { useActionState, useState } from "react";
import { setMemberStatus, type AdminState } from "../../actions";
import styles from "../../admin.module.css";

// 자격중지(사유 필수) / 자격허용. 확인은 화면 안에서
export default function MemberActions({
  userId,
  nickname,
  suspended,
}: {
  userId: string;
  nickname: string;
  suspended: boolean;
}) {
  const [state, action, pending] = useActionState<AdminState, FormData>(setMemberStatus, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <>
        <button type="button" className={`${styles.btn} ${styles.small} ${suspended ? styles.approve : styles.ghost}`}
          onClick={() => setOpen(true)}>
          {suspended ? "자격허용" : "자격중지"}
        </button>
        {state.message && <div className={styles.inlineMsg}>{state.message}</div>}
      </>
    );
  }

  return (
    <form action={action} style={{ minWidth: 220 }}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="suspend" value={suspended ? "0" : "1"} />
      <div style={{ fontSize: 12, marginBottom: 6 }}>
        <b>{nickname}</b>님을 {suspended ? "다시 정상회원으로 바꿀까요?" : "자격중지할까요?"}
      </div>
      {!suspended && (
        <input className={styles.field} name="reason" placeholder="중지 사유 (관리자 기록)" maxLength={300}
          required style={{ width: "100%", marginBottom: 6 }} />
      )}
      {state.error && <div className={styles.inlineErr}>{state.error}</div>}
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" className={`${styles.btn} ${styles.small} ${styles.ghost}`} disabled={pending}
          onClick={() => setOpen(false)}>
          취소
        </button>
        <button className={`${styles.btn} ${styles.small} ${suspended ? styles.approve : styles.reject}`}
          disabled={pending}>
          {pending ? "처리 중…" : suspended ? "자격허용" : "자격중지"}
        </button>
      </div>
    </form>
  );
}
