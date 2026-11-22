import Link from "next/link";
import { Suspense } from "react";
import { can, getAdmin } from "@/lib/auth/admin";
import {
  countPending,
  listAllProducts,
  listPendingProducts,
  timeAgo,
  type AdminProductRow,
} from "@/lib/admin-data";
import { formatPrice } from "@/lib/format";
import styles from "../../admin.module.css";

export const metadata = { title: "상품 관리 · 관리자" };

function StatusBadge({ p }: { p: AdminProductRow }) {
  if (p.status === "sold") return <span className={`${styles.badge} ${styles.muted}`}>거래완료</span>;
  if (p.auth_status === "pending") return <span className={`${styles.badge} ${styles.wait}`}>심사대기</span>;
  if (p.auth_status === "rejected") return <span className={`${styles.badge} ${styles.bad}`}>반려</span>;
  return <span className={`${styles.badge} ${styles.ok}`}>판매중</span>;
}

async function Content({ searchParams }: { searchParams: PageProps<"/admin/products">["searchParams"] }) {
  const [admin, sp] = await Promise.all([getAdmin(), searchParams]);
  if (typeof admin === "string" || !can(admin, "product")) {
    return <p className={styles.empty}>상품 관리 권한이 없어요.</p>;
  }

  const tab = sp.tab === "all" ? "all" : "review";
  const [pendingCount, rows] = await Promise.all([
    countPending(),
    tab === "all" ? listAllProducts() : listPendingProducts(),
  ]);

  return (
    <>
      {sp.done === "approve" && <p className={styles.flash}>승인했어요. 상품이 홈에 공개됩니다.</p>}
      {sp.done === "reject" && <p className={styles.flash}>반려했어요. 판매자에게 사유가 표시됩니다.</p>}

      <div className={styles.tabs}>
        <Link href="/admin/products" className={`${styles.tab} ${tab === "review" ? styles.tabOn : ""}`}>
          정품인증 심사대기 {pendingCount}
        </Link>
        <Link href="/admin/products?tab=all" className={`${styles.tab} ${tab === "all" ? styles.tabOn : ""}`}>
          전체 상품
        </Link>
        <span className={styles.tab} style={{ opacity: 0.5 }}>카테고리/브랜드 (10단계)</span>
      </div>

      <div className={styles.panel}>
        {rows.length === 0 ? (
          <p className={styles.empty}>
            {tab === "review" ? "심사를 기다리는 상품이 없어요." : "등록된 상품이 없어요."}
          </p>
        ) : tab === "review" ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>상품</th><th>판매자</th><th>구매처</th><th>카테고리</th><th>가격</th><th>등록</th><th>처리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link className={styles.name} href={`/admin/products/${p.id}`}>
                      {p.brand_name} {p.title}
                    </Link>
                  </td>
                  <td>{p.seller_nickname}</td>
                  <td>{p.purchase_place_name}</td>
                  <td>{p.top_category_name}</td>
                  <td>{formatPrice(p.price)}</td>
                  <td>{timeAgo(p.created_at)}</td>
                  <td>
                    <Link href={`/admin/products/${p.id}`} className={`${styles.btn} ${styles.primary}`}>
                      심사하기
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>상품</th><th>판매자</th><th>카테고리</th><th>상태</th><th>가격</th><th>등록</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link className={styles.name} href={`/admin/products/${p.id}`}>
                      {p.brand_name} {p.title}
                    </Link>
                  </td>
                  <td>{p.seller_nickname}</td>
                  <td>{p.top_category_name}</td>
                  <td><StatusBadge p={p} /></td>
                  <td>{formatPrice(p.price)}</td>
                  <td>{timeAgo(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default function AdminProductsPage(props: PageProps<"/admin/products">) {
  return (
    <>
      <div className={styles.topbar}>
        <h1>상품 관리</h1>
      </div>
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
