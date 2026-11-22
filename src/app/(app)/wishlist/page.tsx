import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Thumb from "@/components/catalog/Thumb";
import SubTopBar from "@/components/SubTopBar";
import { getSessionUser } from "@/lib/auth/session";
import { listWishlist } from "@/lib/chat";
import { formatPrice } from "@/lib/format";
import styles from "./wishlist.module.css";

export const metadata = { title: "찜한 상품 · Real HAVE" };

async function Content() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/wishlist");
  const items = await listWishlist(user.id);

  return (
    <>
      <p className={styles.count}>
        찜한 상품 <b>{items.length}</b>건
      </p>
      {items.length === 0 ? (
        <p className={styles.empty}>
          아직 찜한 상품이 없어요.
          <br />
          마음에 드는 상품의 <b>♡ 찜</b>을 눌러보세요.
        </p>
      ) : (
        <div className={styles.grid}>
          {items.map((p) => (
            <Link key={p.id} href={`/products/${p.id}`} className={styles.card}>
              <Thumb path={p.thumb_path} brand={p.brand_name} className={styles.thumb}>
                {p.status === "sold" ? (
                  <span className={styles.sold}>거래완료</span>
                ) : (
                  <span className={styles.badge}>정품인증</span>
                )}
              </Thumb>
              <div className={styles.info}>
                <div className={styles.b}>{p.brand_name}</div>
                <div className={styles.n}>{p.title}</div>
                <div className={styles.p}>{formatPrice(p.price)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export default function WishlistPage() {
  return (
    <>
      <SubTopBar title="찜한 상품" fallback="/mypage" />
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
