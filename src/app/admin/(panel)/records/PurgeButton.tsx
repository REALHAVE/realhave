"use client";

import { useState, useTransition } from "react";
import { purgeExpiredRecords, type AdminState } from "../../actions";
import styles from "../../admin.module.css";

export default function PurgeButton({ expired }: { expired: number }) {
  const [ask, setAsk] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminState>({});

  if (expired === 0 && !result.message) {
    return <p className={styles.inlineMsg}>지금 파기할 기록이 없어요.</p>;
  }
  return (
    <>
      {result.error && <p className={styles.error}>{result.error}</p>}
      {result.message && <p className={styles.flash}>{result.message}</p>}
      {expired > 0 &&
        (ask ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13 }}>
              기한이 지난 기록 <b>{expired}건</b>을 영구 삭제할까요? 되돌릴 수 없어요.
            </span>
            <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => setAsk(false)}>취소</button>
            <button type="button" className={`${styles.btn} ${styles.reject}`} disabled={pending}
              onClick={() => start(async () => { setResult(await purgeExpiredRecords()); setAsk(false); })}>
              {pending ? "파기 중…" : "파기"}
            </button>
          </div>
        ) : (
          <button type="button" className={`${styles.btn} ${styles.reject}`} onClick={() => setAsk(true)}>
            보존기간 지난 기록 {expired}건 파기
          </button>
        ))}
    </>
  );
}
