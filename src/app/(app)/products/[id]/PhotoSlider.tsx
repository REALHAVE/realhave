"use client";

import { useState } from "react";
import { productImageUrl } from "@/lib/catalog-url";
import styles from "./detail.module.css";

// 상품 사진 넘겨보기 (손가락으로 좌우 스와이프)
export default function PhotoSlider({ paths, brand }: { paths: string[]; brand: string }) {
  const [index, setIndex] = useState(0);

  if (paths.length === 0) {
    return (
      <div className={styles.photoEmpty}>
        <span>{brand.charAt(0)}</span>
        <small>등록된 사진이 없어요</small>
      </div>
    );
  }

  return (
    <>
      <div
        className={styles.slider}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {paths.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p} src={productImageUrl(p)} alt={`상품 사진 ${i + 1}`} className={styles.slide} />
        ))}
      </div>
      {paths.length > 1 && (
        <div className={styles.dots} aria-hidden="true">
          {paths.map((p, i) => (
            <span key={p} className={i === index ? styles.dotOn : undefined} />
          ))}
        </div>
      )}
    </>
  );
}
