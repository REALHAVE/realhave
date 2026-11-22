"use client";

import { useActionState, useState } from "react";
import { chatTimeLabel } from "@/lib/format";
import { completeDeal, type ActionResult } from "../../actions";
import styles from "../../sales.module.css";

type Candidate = { buyerId: string; nickname: string; lastMessage: string | null; lastAt: string };

// 목업 "구매자 선택": 채팅한 사람 중에서 고르거나, 선택하지 않고 거래완료
// (브라우저 기본 확인창은 앱 안 브라우저에서 안 뜨는 경우가 있어 화면 안에서 확인)
export default function CompleteForm({
  productId,
  candidates,
}: {
  productId: string;
  candidates: Candidate[];
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(completeDeal, {});
  const [showList, setShowList] = useState(false);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [confirming, setConfirming] = useState<"buyer" | "none" | null>(null);

  if (confirming) {
    const buyer = confirming === "buyer" ? selected : null;
    return (
      <form action={action} className={styles.confirmBox}>
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="buyerId" value={buyer?.buyerId ?? ""} />
        <p>
          {buyer ? (
            <>
              <b>{buyer.nickname}</b>님을 구매자로 해서 <b>거래완료</b>로 바꿀까요?
              <br />
              구매자의 구매내역에도 기록돼요.
            </>
          ) : (
            <>
              구매자 없이 <b>거래완료</b>로 바꿀까요?
            </>
          )}
          <br />
          바꾼 뒤에는 판매중으로 되돌릴 수 없어요.
        </p>
        {state.error && <p className={styles.formError}>{state.error}</p>}
        <div className={styles.confirmRow}>
          <button type="button" className={styles.confirmCancel} disabled={pending} onClick={() => setConfirming(null)}>
            취소
          </button>
          <button className={styles.confirmOk} disabled={pending}>
            {pending ? "처리 중…" : "거래완료로 변경"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      {state.error && <p className={styles.formError}>{state.error}</p>}

      <button
        type="button"
        className={`${styles.skip} ${selected ? "" : styles.notReady}`}
        disabled={!selected}
        onClick={() => setConfirming("buyer")}
      >
        {selected ? `${selected.nickname}님으로 거래완료` : "구매자 선택"}
      </button>

      {!showList ? (
        <button type="button" className={styles.findBtn} onClick={() => setShowList(true)}>
          최근 채팅 목록에서 구매자 찾기
        </button>
      ) : candidates.length === 0 ? (
        <p className={styles.hint} style={{ textAlign: "center" }}>
          이 상품으로 대화한 회원이 없어요.
        </p>
      ) : (
        <ul className={styles.buyerList}>
          {candidates.map((c) => (
            <li key={c.buyerId}>
              <button
                type="button"
                className={`${styles.buyerRow} ${selected?.buyerId === c.buyerId ? styles.buyerSel : ""}`}
                aria-pressed={selected?.buyerId === c.buyerId}
                onClick={() => setSelected(c)}
              >
                <span className={styles.buyerAvatar} aria-hidden="true">
                  {c.nickname.charAt(0)}
                </span>
                <span className={styles.buyerInfo}>
                  <span className={styles.buyerName}>
                    {c.nickname}
                    <small>{chatTimeLabel(c.lastAt)}</small>
                  </span>
                  <span className={styles.buyerMsg}>{c.lastMessage ?? ""}</span>
                </span>
                {selected?.buyerId === c.buyerId && <span className={styles.check}>✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className={styles.skipText} onClick={() => setConfirming("none")}>
        선택하지 않을래요
      </button>
    </>
  );
}
