"use client";

import { useActionState } from "react";
import { handleReport, type AdminState } from "../../../actions";
import styles from "../../../admin.module.css";

export default function HandleForm({ reportId, status, note }: { reportId: string; status: string; note: string }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(handleReport, {});
  return (
    <form action={action}>
      <input type="hidden" name="reportId" value={reportId} />
      <label className={styles.label} htmlFor="status">상태</label>
      <select id="status" name="status" defaultValue={status} className={styles.field} style={{ width: "100%" }}>
        <option value="open">미처리</option>
        <option value="resolved">처리완료 (조치함)</option>
        <option value="dismissed">기각 (문제 없음)</option>
      </select>
      <label className={styles.label} htmlFor="note">관리자 메모 (신고자에게는 보이지 않아요)</label>
      <textarea id="note" name="note" defaultValue={note} maxLength={1000} className={styles.textarea}
        placeholder="예) 판매자에게 인증서류 재제출 요청, 상품 숨김 처리" />
      {state.error && <p className={styles.error}>{state.error}</p>}
      {state.message && <p className={styles.flash}>{state.message}</p>}
      <button className={`${styles.btn} ${styles.primary} ${styles.full}`} disabled={pending}>
        {pending ? "저장 중…" : "저장"}
      </button>
    </form>
  );
}
