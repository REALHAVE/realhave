import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import SubTopBar from "@/components/SubTopBar";
import { getSessionUser } from "@/lib/auth/session";
import { productImageUrl } from "@/lib/catalog-url";
import { listPurchases } from "@/lib/chat";
import { formatPrice } from "@/lib/format";
import styles from "../sales/sales.module.css";

export const metadata = { title: "구매내역 · Real HAVE" };

function ymd(iso: string) {
  return new Date(iso)
    .toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
    .replace(/\s/g, "")
    .replace(/\.$/, "");
}

async function Content() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/purchases");
  const items = await listPurchases(user.id);

  if (items.length === 0) {
    return (
      <p className={styles.empty}>
        아직 구매내역이 없어요.
        <br />
        판매자가 거래완료할 때 구매자로 선택하면 여기에 기록돼요.
      </p>
    );
  }

  return (
    <div className={styles.list} style={{ paddingTop: 14 }}>
      {items.map((p) => (
        <div key={p.productId} className={styles.card}>
          <div className={styles.statusRow}>
            <span className={`${styles.status} ${styles.onSale}`}>구매완료</span>
          </div>
          <Link href={`/products/${p.productId}`} className={styles.body}>
            <div className={styles.thumb}>
              {p.thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={productImageUrl(p.thumb)} alt="" />
              )}
            </div>
            <div className={styles.info}>
              <div className={styles.n}>
                {p.brand} {p.title}
              </div>
              <div className={styles.meta}>
                {p.sellerNickname} · 구매일 {ymd(p.completedAt)}
              </div>
              <div className={styles.p}>{formatPrice(p.price)}</div>
            </div>
          </Link>
          {p.roomId && (
            <div className={styles.actions}>
              <Link href={`/chat/${p.roomId}`} className={styles.actionBtn}>
                채팅하기
              </Link>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function PurchasesPage() {
  return (
    <>
      <SubTopBar title="구매내역" fallback="/mypage" />
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
