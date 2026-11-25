"use client";

import { useActionState, useState } from "react";
import { deleteMember, type AdminState } from "../../actions";
import styles from "../../admin.module.css";

// 회원 삭제: 되돌릴 수 없어서 '삭제'를 직접 입력해야 진행
export default function DeleteMember({ userId, nickname }: { userId: string; nickname: string }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(deleteMember, {});
  const [open, setOpen] = useState(false);

  if (state.message) return <span className={styles.inlineMsg}>{state.message}</span>;
  if (!open) {
    return (
      <button type="button" className={`${styles.btn} ${styles.small} ${styles.reject}`} onClick={() => setOpen(true)}>
        회원삭제
      </button>
    );
  }
  return (
    <form action={action} style={{ minWidth: 240, marginTop: 6 }}>
      <input type="hidden" name="userId" value={userId} />
      <div style={{ fontSize: 12, marginBottom: 6, lineHeight: 1.5 }}>
        <b>{nickname}</b>님의 상품·채팅·거래기록이 <b>모두 삭제</b>되고 복구할 수 없어요.
        (신고 처리 중인 대화는 증거로 보관) 진행하려면 <b>삭제</b>라고 입력하세요.
      </div>
      <input className={styles.field} name="confirm" placeholder="삭제" required style={{ width: "100%", marginBottom: 6 }} />
      {state.error && <div className={styles.inlineErr}>{state.error}</div>}
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" className={`${styles.btn} ${styles.small} ${styles.ghost}`} disabled={pending}
          onClick={() => setOpen(false)}>
          취소
        </button>
        <button className={`${styles.btn} ${styles.small} ${styles.reject}`} disabled={pending}>
          {pending ? "삭제 중…" : "회원삭제"}
        </button>
      </div>
    </form>
  );
}
