"use client";

import { useActionState, useTransition, useState } from "react";
import { handleReport, openSupportThread, type AdminState } from "../../../actions";
import styles from "../../../admin.module.css";

// 상황별 결과 안내 예시 (눌러서 채우고 고칠 수 있음)
const RESULT_TEMPLATES: Record<string, string> = {
  resolved: "신고해주셔서 감사합니다. 확인 결과 상대 회원에게 조치(경고·이용 제한 등)를 했어요.",
  dismissed: "확인 결과 운영 정책 위반 사항이 발견되지 않았어요. 불편을 드려 죄송합니다.",
};

export default function HandleForm({
  reportId,
  status,
  note,
  result,
  targetUserId,
  targetUser,
  isChatReport,
}: {
  reportId: string;
  status: string;
  note: string;
  result: string;
  targetUserId: string | null;
  targetUser: string | null;
  isChatReport: boolean;
}) {
  const [state, action, pending] = useActionState<AdminState, FormData>(handleReport, {});
  const [st, setSt] = useState(status);
  const [msg, setMsg] = useState(result);
  const [opening, startOpen] = useTransition();
  const [openError, setOpenError] = useState("");

  return (
    <>
      <form action={action}>
        <input type="hidden" name="reportId" value={reportId} />
        <label className={styles.label} htmlFor="status">상태</label>
        <select id="status" name="status" value={st} onChange={(e) => setSt(e.target.value)}
          className={styles.field} style={{ width: "100%" }}>
          <option value="open">미처리 (신고자에게 &lsquo;확인 중&rsquo;으로 보임)</option>
          <option value="resolved">처리완료 (조치함)</option>
          <option value="dismissed">기각 (문제 없음)</option>
        </select>

        <label className={styles.label} htmlFor="result">
          신고자에게 보일 결과 안내 {isChatReport && "(신고자의 채팅방 위쪽에 표시)"}
        </label>
        <textarea id="result" name="result" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={1000}
          className={styles.textarea} placeholder="처리완료·기각으로 바꿀 때 신고자에게 알려줄 내용" />
        {RESULT_TEMPLATES[st] && (
          <button type="button" className={`${styles.btn} ${styles.small} ${styles.ghost}`}
            style={{ marginTop: -4, marginBottom: 8, whiteSpace: "normal", textAlign: "left" }}
            onClick={() => setMsg(RESULT_TEMPLATES[st])}>
            예시 문구 넣기
          </button>
        )}

        <label className={styles.label} htmlFor="note">관리자 메모 (관리자끼리만 보여요)</label>
        <textarea id="note" name="note" defaultValue={note} maxLength={1000} className={styles.textarea}
          placeholder="예) 판매자에게 인증서류 재제출 요청, 상품 숨김 처리" />
        {state.error && <p className={styles.error}>{state.error}</p>}
        {state.message && <p className={styles.flash}>{state.message}</p>}
        <button className={`${styles.btn} ${styles.primary} ${styles.full}`} disabled={pending}>
          {pending ? "저장 중…" : "저장"}
        </button>
      </form>

      {targetUserId && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
          <p className={styles.note} style={{ marginTop: 0, marginBottom: 8 }}>
            관리자 개입이 필요하면 <b>{targetUser}</b>님과 1:1로 대화할 수 있어요. 상대 회원의 채팅 목록에
            &lsquo;리얼해브 관리자&rsquo;로 보이고, <b>신고자는 볼 수 없어요.</b>
          </p>
          {openError && <p className={styles.error}>{openError}</p>}
          <button type="button" className={`${styles.btn} ${styles.approve} ${styles.full}`} disabled={opening}
            onClick={() =>
              startOpen(async () => {
                const r = await openSupportThread(targetUserId, reportId);
                if (r?.error) setOpenError(r.error);
              })
            }>
            {opening ? "여는 중…" : `💬 ${targetUser ?? "신고 대상 회원"}님과 채팅하기`}
          </button>
        </div>
      )}
    </>
  );
}
