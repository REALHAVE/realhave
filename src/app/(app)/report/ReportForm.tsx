"use client";

import { useActionState } from "react";
import { createReport, type FormState } from "../support/actions";
import styles from "../support/support.module.css";

const REASONS = [
  { code: "fake_suspect", name: "정품 의심" },
  { code: "false_listing", name: "허위매물" },
  { code: "no_response", name: "응답 없음" },
  { code: "bad_manner", name: "비매너" },
  { code: "etc", name: "기타" },
];

export default function ReportForm({ kind, targetId }: { kind: "product" | "chat"; targetId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createReport, {});
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="targetId" value={targetId} />
      <span className={styles.label}>신고 사유</span>
      <div className={styles.reasons}>
        {REASONS.map((r, i) => (
          <label key={r.code} className={styles.reason}>
            <input type="radio" name="reason" value={r.code} required defaultChecked={i === 0} />
            {r.name}
          </label>
        ))}
      </div>
      <label className={styles.label} htmlFor="detail">자세한 내용 (선택, 기타는 필수)</label>
      <textarea id="detail" name="detail" className={`${styles.input} ${styles.textarea}`} maxLength={1000}
        placeholder="어떤 점이 문제인지 적어주시면 빠르게 확인할 수 있어요." />
      {state.error && <p className={styles.error}>{state.error}</p>}
      <p className={styles.hint}>
        {kind === "chat"
          ? "채팅을 신고하면 리얼해브 관리자가 이 대화 내용을 확인해요. (신고되지 않은 대화는 관리자도 볼 수 없어요)"
          : "신고한 사람은 상대방에게 알려지지 않아요."}
      </p>
      <button className={`${styles.btn} ${styles.btnDanger}`} disabled={pending} style={{ marginTop: 16 }}>
        {pending ? "신고하는 중…" : "신고하기"}
      </button>
    </form>
  );
}
