import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Thumb from "@/components/catalog/Thumb";
import SubTopBar from "@/components/SubTopBar";
import { getSessionUser } from "@/lib/auth/session";
import { listMyProducts, type ProductCard } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import styles from "./sales.module.css";

export const metadata = { title: "판매내역 · Real HAVE" };

// 판매내역 (간단 버전). 끌어올리기·⋮ 메뉴·거래완료 처리는 9단계
function statusOf(p: ProductCard) {
  if (p.status === "sold") return { label: "거래완료", cls: styles.done };
  if (p.auth_status === "pending") return { label: "심사대기", cls: styles.pending };
  if (p.auth_status === "rejected") return { label: "반려", cls: styles.rejected };
  return { label: "판매중", cls: styles.onSale };
}

async function SalesContent({ searchParams }: { searchParams: PageProps<"/sales">["searchParams"] }) {
  const [user, sp] = await Promise.all([getSessionUser(), searchParams]);
  if (!user) redirect("/login?next=/sales");

  const items = await listMyProducts(user.id);

  return (
    <>
      {sp.created === "1" && (
        <p className={styles.success}>
          상품이 등록되었어요! <b>정품인증 심사</b>가 끝나면 다른 회원에게 공개돼요.
        </p>
      )}

      {items.length === 0 ? (
        <div className={styles.empty}>
          <p>아직 등록한 상품이 없어요.</p>
          <Link href="/sell" className={styles.btn}>상품 등록하기</Link>
        </div>
      ) : (
        <ul className={styles.list}>
          {items.map((p) => {
            const s = statusOf(p);
            return (
              <li key={p.id}>
                <Link href={`/products/${p.id}`} className={styles.row}>
                  <Thumb path={p.thumb_path} brand={p.brand_name} className={styles.thumb} />
                  <div className={styles.info}>
                    <span className={`${styles.status} ${s.cls}`}>{s.label}</span>
                    <div className={styles.b}>{p.brand_name}</div>
                    <div className={styles.n}>{p.title}</div>
                    <div className={styles.p}>{formatPrice(p.price)}</div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function SalesPage(props: PageProps<"/sales">) {
  return (
    <>
      <SubTopBar title="판매내역" fallback="/mypage" />
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <SalesContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
