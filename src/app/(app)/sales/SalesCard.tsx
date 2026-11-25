"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ProductCard } from "@/lib/catalog";
import { productImageUrl } from "@/lib/catalog-url";
import { formatPrice } from "@/lib/format";
import { bumpProduct, deleteProduct, relistProduct, type ActionResult } from "./actions";
import styles from "./sales.module.css";

function statusOf(p: ProductCard) {
  if (p.status === "sold") return { label: "거래완료", cls: styles.done };
  if (p.auth_status === "pending") return { label: "심사대기", cls: styles.pending };
  if (p.auth_status === "rejected") return { label: "반려 · 수정 후 재심사", cls: styles.rejected };
  return { label: "판매중", cls: styles.onSale };
}

export default function SalesCard({
  p,
  meta,
  bumpWait,
  reported,
}: {
  p: ProductCard;
  meta: string;
  bumpWait: number;
  reported: boolean; // 신고 처리 중 → 삭제 불가
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const [askDelete, setAskDelete] = useState(false); // 메뉴 안에서 삭제 확인
  const [result, setResult] = useState<ActionResult>({});
  const [pending, start] = useTransition();
  const s = statusOf(p);
  const isSold = p.status === "sold";
  const canBump = !isSold && p.auth_status === "approved";

  function closeSheet() {
    setSheet(false);
    setAskDelete(false);
  }

  function run(fn: () => Promise<ActionResult>) {
    closeSheet();
    start(async () => {
      const r = await fn();
      setResult(r ?? {});
      router.refresh();
    });
  }

  return (
    <div className={styles.card}>
      <div className={styles.statusRow}>
        <span className={`${styles.status} ${s.cls}`}>{s.label}</span>
        <button type="button" className={styles.dots} aria-label="메뉴" onClick={() => setSheet(true)}>
          ⋮
        </button>
      </div>

      <Link href={`/products/${p.id}`} className={styles.body} style={isSold ? { opacity: 0.6 } : undefined}>
        <div className={styles.thumb}>
          {p.thumb_path && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={productImageUrl(p.thumb_path)} alt="" />
          )}
        </div>
        <div className={styles.info}>
          <div className={styles.n}>
            {p.brand_name} {p.title}
          </div>
          <div className={styles.meta}>{meta}</div>
          <div className={styles.p}>{formatPrice(p.price)}</div>
        </div>
      </Link>

      <div className={styles.counts}>조회 {p.view_count.toLocaleString("ko-KR")}</div>

      {result.error && <p className={styles.cardError}>{result.error}</p>}
      {result.message && <p className={styles.cardMsg}>{result.message}</p>}

      {!isSold && (
        <div className={styles.actions}>
          {canBump ? (
            <button type="button" className={styles.actionBtn} disabled={pending || bumpWait > 0}
              onClick={() => run(() => bumpProduct(p.id))}>
              {bumpWait > 0 ? `끌어올리기 (${bumpWait}시간 후 가능)` : "끌어올리기"}
            </button>
          ) : (
            <Link href={`/sales/${p.id}/edit`} className={styles.actionBtn}>
              {p.auth_status === "rejected" ? "수정하고 재심사 요청" : "심사 중에도 수정할 수 있어요"}
            </Link>
          )}
        </div>
      )}

      {sheet && (
        <>
          <div className={styles.backdrop} onClick={closeSheet} />
          <div className={styles.sheet} role="dialog" aria-label="상품 메뉴">
            <div className={styles.handle} />
            {askDelete && reported ? (
              <>
                <p className={styles.sheetConfirm}>
                  🚨 신고 처리 중인 상품이에요
                  <small>
                    이 상품에 대한 신고를 리얼해브 관리자가 확인하고 있어서 지금은 삭제할 수 없어요.
                    확인이 끝나면 삭제할 수 있어요.
                  </small>
                </p>
                <div className={styles.confirmRow} style={{ padding: "0 20px 10px" }}>
                  <button type="button" className={styles.confirmOk} onClick={closeSheet}>
                    확인
                  </button>
                </div>
              </>
            ) : askDelete ? (
              <>
                <p className={styles.sheetConfirm}>
                  이 상품을 삭제할까요?
                  <small>삭제하면 되돌릴 수 없어요.</small>
                </p>
                <div className={styles.confirmRow} style={{ padding: "0 20px 10px" }}>
                  <button type="button" className={styles.confirmCancel} onClick={() => setAskDelete(false)}>
                    취소
                  </button>
                  <button type="button" className={`${styles.confirmOk} ${styles.confirmDanger}`}
                    onClick={() => run(() => deleteProduct(p.id))}>
                    삭제
                  </button>
                </div>
              </>
            ) : isSold ? (
              <button type="button" className={styles.option} onClick={() => run(() => relistProduct(p.id))}>
                재등록
              </button>
            ) : (
              <>
                <Link href={`/sales/${p.id}/complete`} className={styles.option}>
                  거래완료로 변경
                </Link>
                <Link href={`/sales/${p.id}/edit`} className={styles.option}>
                  게시글 수정
                </Link>
              </>
            )}
            {!askDelete && (
              <>
                <button type="button" className={`${styles.option} ${styles.danger}`}
                  onClick={() => setAskDelete(true)}>
                  삭제
                </button>
                <button type="button" className={styles.close} onClick={closeSheet}>
                  닫기
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
