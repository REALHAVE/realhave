"use client";

import { useActionState } from "react";
import SubTopBar from "@/components/SubTopBar";
import { createInquiry, type FormState } from "../actions";
import styles from "../support.module.css";

export default function NewInquiryPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(createInquiry, {});
  return (
    <>
      <SubTopBar title="1:1 문의하기" fallback="/support" />
      <form action={action} className={styles.form}>
        <label className={styles.label} htmlFor="title">제목</label>
        <input id="title" name="title" className={styles.input} maxLength={100} required
          placeholder="예) 상품등록 사이즈 선택이 안 돼요" />
        <label className={styles.label} htmlFor="body">내용</label>
        <textarea id="body" name="body" className={`${styles.input} ${styles.textarea}`} maxLength={3000} required
          placeholder="문의하실 내용을 자세히 적어주세요. (상품명, 상황 등)" />
        {state.error && <p className={styles.error}>{state.error}</p>}
        <p className={styles.hint}>답변은 고객센터 목록에서 확인할 수 있어요. 개인정보(카드번호 등)는 적지 마세요.</p>
        <button className={styles.btn} disabled={pending} style={{ marginTop: 16 }}>
          {pending ? "보내는 중…" : "문의 보내기"}
        </button>
      </form>
    </>
  );
}
