"use client";

import { useActionState } from "react";
import { completeDeal, type ActionResult } from "../../actions";
import styles from "../../sales.module.css";

export default function CompleteForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(completeDeal, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("구매자 없이 거래완료로 바꿀까요? 바꾼 뒤에는 판매중으로 되돌릴 수 없어요.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="productId" value={productId} />
      {state.error && <p className={styles.formError}>{state.error}</p>}
      <button className={styles.skip} disabled={pending}>
        {pending ? "처리 중…" : "선택하지 않을래요 (거래완료로 변경)"}
      </button>
    </form>
  );
}
