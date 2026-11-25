"use client";

import { useActionState } from "react";
import { answerInquiry, type AdminState } from "../../../actions";
import styles from "../../../admin.module.css";

export default function AnswerForm({ inquiryId, answer }: { inquiryId: string; answer: string }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(answerInquiry, {});
  return (
    <form action={action}>
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <textarea name="answer" defaultValue={answer} maxLength={3000} className={styles.textarea}
        style={{ minHeight: 180 }} placeholder="회원에게 보여질 답변을 입력하세요." />
      {state.error && <p className={styles.error}>{state.error}</p>}
      {state.message && <p className={styles.flash}>{state.message}</p>}
      <button className={`${styles.btn} ${styles.primary} ${styles.full}`} disabled={pending}>
        {pending ? "저장 중…" : answer ? "답변 수정" : "답변 등록"}
      </button>
    </form>
  );
}
