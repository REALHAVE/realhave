import { productImageUrl } from "@/lib/catalog-url";
import styles from "./catalog.module.css";

// 상품 대표사진. 사진이 없으면 크림색 자리 + 브랜드 첫 글자
export default function Thumb({
  path,
  brand,
  className,
  children,
}: {
  path: string | null;
  brand: string;
  className: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={className}>
      {path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.img} src={productImageUrl(path)} alt="" loading="lazy" />
      ) : (
        <span className={styles.noImg} aria-hidden="true">
          {brand.charAt(0)}
        </span>
      )}
      {children}
    </div>
  );
}
