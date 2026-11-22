import Link from "next/link";
import { Suspense } from "react";
import ListedCard from "@/components/catalog/ListedCard";
import TopBar from "@/components/TopBar";
import { getPopularBrands, listProducts } from "@/lib/catalog";
import styles from "./home.module.css";

async function PopularBrands() {
  const brands = await getPopularBrands();
  return (
    <div className={styles.brandGrid}>
      {brands.map((b) => (
        <Link key={b.id} href={`/list?brand=${b.id}`} className={styles.brandTile}>
          {b.name_en}
        </Link>
      ))}
    </div>
  );
}

async function LatestProducts() {
  const { items } = await listProducts({ limit: 20 });
  if (items.length === 0)
    return <p className={styles.emptyRow}>아직 등록된 상품이 없어요.</p>;

  return (
    <div className={styles.scroll}>
      {items.map((p) => (
        <ListedCard key={p.id} p={p} isNew={p.is_new} />
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <TopBar />

      <Link href="/search" className={styles.search}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        브랜드, 상품명으로 검색
      </Link>

      <div className={styles.secHead}>
        <h2>인기브랜드</h2>
        <Link href="/designers" className={styles.more}>전체보기 ›</Link>
      </div>
      <Suspense fallback={<div className={styles.brandGridSkeleton} />}>
        <PopularBrands />
      </Suspense>

      <div className={styles.secHead}>
        <h2>최신등록상품</h2>
        <Link href="/list?latest=1" className={styles.more}>최대 20개까지 보기 ›</Link>
      </div>
      <Suspense fallback={<div className={styles.scrollSkeleton} />}>
        <LatestProducts />
      </Suspense>
    </>
  );
}
