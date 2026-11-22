import Link from "next/link";
import type { ProductCard } from "@/lib/catalog";
import { formatPrice, sizeLabel } from "@/lib/format";
import Thumb from "./Thumb";
import styles from "./catalog.module.css";

// 목록·검색결과 한 줄 (목업 result-row)
export function ProductRow({ p }: { p: ProductCard }) {
  return (
    <Link href={`/products/${p.id}`} className={styles.row}>
      <Thumb path={p.thumb_path} brand={p.brand_name} className={styles.rowThumb}>
        <span className={styles.badge}>정품인증</span>
      </Thumb>
      <div className={styles.rowInfo}>
        <div className={styles.b}>{p.brand_name}</div>
        <div className={styles.n}>{p.title}</div>
        <div className={styles.meta}>
          {p.top_category_name} · {p.purchase_place_name} · {sizeLabel(p.size)} ·{" "}
          {p.condition_grade}
        </div>
        <div className={styles.p}>{formatPrice(p.price)}</div>
      </div>
    </Link>
  );
}

export function ProductList({ items, empty }: { items: ProductCard[]; empty: string }) {
  if (items.length === 0) return <p className={styles.empty}>{empty}</p>;
  return (
    <div className={styles.list}>
      {items.map((p) => (
        <ProductRow key={p.id} p={p} />
      ))}
    </div>
  );
}
