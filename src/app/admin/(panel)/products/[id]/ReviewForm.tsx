"use client";

import { useActionState, useState } from "react";
import { reviewProduct, type ReviewState } from "../../../actions";
import styles from "../../../admin.module.css";

// 자주 쓰는 반려 사유 (눌러서 채우고 고칠 수 있음)
const QUICK_REASONS = [
  "한글표기 택 또는 인보이스가 잘 보이지 않아요. 선명한 사진으로 다시 올려주세요.",
  "인증 서류의 브랜드·상품이 등록 정보와 달라요.",
  "국내 정식 구매처에서 구입한 증빙이 확인되지 않아요.",
];

export default function ReviewForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(reviewProduct, {});
  const [reason, setReason] = useState("");
  const [approveAsk, setApproveAsk] = useState(false);

  return (
    <form action={action} className={styles.decide}>
      <input type="hidden" name="productId" value={productId} />
      {state.error && <p className={styles.error}>{state.error}</p>}

      {/* 확인은 화면 안에서 (앱 안 브라우저는 기본 확인창이 안 뜨는 경우가 있음) */}
      {approveAsk ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className={`${styles.btn} ${styles.ghost} ${styles.full}`}
            disabled={pending} onClick={() => setApproveAsk(false)}>
            취소
          </button>
          <button className={`${styles.btn} ${styles.approve} ${styles.full}`}
            name="decision" value="approve" disabled={pending}>
            {pending ? "처리 중…" : "승인 확정 (바로 공개)"}
          </button>
        </div>
      ) : (
        <button type="button" className={`${styles.btn} ${styles.approve} ${styles.full}`}
          disabled={pending} onClick={() => setApproveAsk(true)}>
          승인 (공개)
        </button>
      )}

      <div>
        <label htmlFor="reason" style={{ fontSize: 12.5, fontWeight: 700 }}>
          반려 사유 <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>(판매자에게 표시돼요)</span>
        </label>
        <textarea
          id="reason"
          name="reason"
          className={styles.textarea}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="예) 한글 택 사진이 흐려서 확인이 어려워요."
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {QUICK_REASONS.map((r) => (
            <button key={r} type="button" className={`${styles.btn} ${styles.ghost}`}
              style={{ textAlign: "left", whiteSpace: "normal", fontWeight: 500 }}
              onClick={() => setReason(r)}>
              {r}
            </button>
          ))}
        </div>
        <button
          className={`${styles.btn} ${styles.reject} ${styles.full}`}
          name="decision"
          value="reject"
          disabled={pending || !reason.trim()}
        >
          반려
        </button>
      </div>
    </form>
  );
}
