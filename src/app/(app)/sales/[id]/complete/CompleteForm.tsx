"use client";

import { useActionState, useState } from "react";
import { completeDeal, type ActionResult } from "../../actions";
import styles from "../../sales.module.css";

// 브라우저 기본 확인창(confirm)은 카카오톡 등 앱 안 브라우저에서 안 뜨는 경우가 있어 화면 안에서 확인
export default function CompleteForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(completeDeal, {});
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <>
        {state.error && <p className={styles.formError}>{state.error}</p>}
        <button type="button" className={styles.skip} onClick={() => setConfirming(true)}>
          선택하지 않을래요
        </button>
      </>
    );
  }

  return (
    <form action={action} className={styles.confirmBox}>
      <input type="hidden" name="productId" value={productId} />
      <p>
        구매자 없이 <b>거래완료</b>로 바꿀까요?
        <br />
        바꾼 뒤에는 판매중으로 되돌릴 수 없어요.
      </p>
      {state.error && <p className={styles.formError}>{state.error}</p>}
      <div className={styles.confirmRow}>
        <button type="button" className={styles.confirmCancel} disabled={pending} onClick={() => setConfirming(false)}>
          취소
        </button>
        <button className={styles.confirmOk} disabled={pending}>
          {pending ? "처리 중…" : "거래완료로 변경"}
        </button>
      </div>
    </form>
  );
}
