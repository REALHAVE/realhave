import Link from "next/link";
import type { ProductCard } from "@/lib/catalog";
import { conditionLabel, formatPrice } from "@/lib/format";
import Thumb from "./Thumb";
import styles from "./catalog.module.css";

// 홈 "최신등록상품" 가로 스크롤 카드 (목업 listed-card)
export default function ListedCard({ p, isNew }: { p: ProductCard; isNew: boolean }) {
  return (
    <Link href={`/products/${p.id}`} className={styles.card}>
      <Thumb path={p.thumb_path} brand={p.brand_name} className={styles.cardThumb}>
        {isNew && <span className={styles.newBadge}>NEW</span>}
      </Thumb>
      <div className={styles.cardInfo}>
        <div className={styles.b}>{p.brand_name}</div>
        <div className={styles.cardName}>{p.title}</div>
        <div className={styles.used}>{conditionLabel(p.condition_grade)}</div>
        <div className={styles.p}>{formatPrice(p.price)}</div>
      </div>
    </Link>
  );
}
