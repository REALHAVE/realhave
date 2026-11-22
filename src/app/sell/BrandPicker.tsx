"use client";

import { useMemo, useState } from "react";
import type { Brand } from "@/lib/catalog";
import styles from "./sell.module.css";

// 상품등록의 브랜드 선택 화면 (목업 brandpick)
export default function BrandPicker({
  brands,
  selectedId,
  onSelect,
  onClose,
}: {
  brands: Brand[];
  selectedId?: string;
  onSelect: (b: Brand) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? brands.filter(
          (b) => b.name_en.toLowerCase().includes(q) || (b.name_ko ?? "").includes(q),
        )
      : brands;
    const map = new Map<string, Brand[]>();
    for (const b of list) map.set(b.index_letter, [...(map.get(b.index_letter) ?? []), b]);
    return [...map.entries()];
  }, [brands, query]);

  return (
    <div className={styles.picker}>
      <div className={styles.pickerBar}>
        <button type="button" className={styles.back} aria-label="뒤로" onClick={onClose}>
          ←
        </button>
        <h2>브랜드 선택</h2>
      </div>
      <div className={styles.pickerSearch}>
        <input
          className={styles.input}
          type="search"
          placeholder="브랜드명을 검색하세요 (영문/한글)"
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {groups.length === 0 && (
        <p className={styles.pickerEmpty}>
          찾는 브랜드가 없어요.
          <br />
          목록에 없는 브랜드는 고객센터로 추가를 요청해 주세요.
        </p>
      )}

      {groups.map(([letter, list]) => (
        <section key={letter}>
          <div className={styles.letter}>{letter}</div>
          {list.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`${styles.brandRow} ${b.id === selectedId ? styles.brandSel : ""}`}
              onClick={() => onSelect(b)}
            >
              <span className={styles.logo} aria-hidden="true">{b.name_en.charAt(0)}</span>
              <span className={styles.brandText}>
                <span className={styles.brandName}>{b.name_en}</span>
                <span className={styles.origin}>
                  {[b.name_ko, b.origin_country].filter(Boolean).join(" · ")}
                </span>
              </span>
              {b.id === selectedId && <span className={styles.check}>✓</span>}
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
