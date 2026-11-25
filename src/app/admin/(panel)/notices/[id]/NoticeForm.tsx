"use client";

import { useActionState, useState, useTransition } from "react";
import type { NoticeRow } from "@/lib/admin-data";
import { deleteNotice, saveNotice, type AdminState } from "../../../actions";
import styles from "../../../admin.module.css";

export default function NoticeForm({ notice }: { notice?: NoticeRow }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(saveNotice, {});
  const [askDelete, setAskDelete] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [delError, setDelError] = useState("");

  return (
    <div className={styles.panel} style={{ maxWidth: 760 }}>
      <form action={action}>
        {notice && <input type="hidden" name="id" value={notice.id} />}
        <label className={styles.label} htmlFor="kind">구분</label>
        <select id="kind" name="kind" defaultValue={notice?.kind ?? "notice"} className={styles.field}>
          <option value="notice">공지</option>
          <option value="event">이벤트</option>
        </select>

        <label className={styles.label} htmlFor="title">제목</label>
        <input id="title" name="title" defaultValue={notice?.title} maxLength={100} required
          className={styles.field} style={{ width: "100%" }} />

        <label className={styles.label} htmlFor="body">내용</label>
        <textarea id="body" name="body" defaultValue={notice?.body} className={styles.textarea}
          style={{ minHeight: 280 }} />

        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, margin: "6px 0 14px" }}>
          <input type="checkbox" name="publish" defaultChecked={notice?.is_published ?? true} />
          회원에게 게시하기 (체크 해제 = 임시저장)
        </label>

        {state.error && <p className={styles.error}>{state.error}</p>}
        <button className={`${styles.btn} ${styles.primary} ${styles.full}`} disabled={pending}>
          {pending ? "저장 중…" : "저장"}
        </button>
      </form>

      {notice && (
        <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          {delError && <p className={styles.error}>{delError}</p>}
          {askDelete ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 13 }}>이 글을 삭제할까요?</span>
              <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => setAskDelete(false)}>취소</button>
              <button type="button" className={`${styles.btn} ${styles.reject}`} disabled={deleting}
                onClick={() =>
                  startDelete(async () => {
                    const r = await deleteNotice(notice.id);
                    if (r?.error) setDelError(r.error);
                  })
                }>
                삭제
              </button>
            </div>
          ) : (
            <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => setAskDelete(true)}>
              글 삭제
            </button>
          )}
        </div>
      )}
    </div>
  );
}
