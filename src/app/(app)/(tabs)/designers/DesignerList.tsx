"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Brand } from "@/lib/catalog";
import styles from "./designers.module.css";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function DesignerList({ brands }: { brands: Brand[] }) {
  const [query, setQuery] = useState("");

  // 영문·한글 브랜드명으로 검색
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter(
      (b) => b.name_en.toLowerCase().includes(q) || (b.name_ko ?? "").includes(q),
    );
  }, [brands, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Brand[]>();
    for (const b of filtered) {
      const list = map.get(b.index_letter) ?? [];
      list.push(b);
      map.set(b.index_letter, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const available = new Set(groups.map(([l]) => l));

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>A-Z Designers</h1>
        <input
          className={styles.search}
          type="search"
          placeholder="브랜드명을 검색하세요"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={styles.body}>
        <div className={styles.list}>
          {groups.length === 0 && <p className={styles.empty}>검색된 브랜드가 없어요.</p>}
          {groups.map(([letter, list]) => (
            <section key={letter}>
              <div id={`letter-${letter}`} className={styles.letter}>
                {letter}
              </div>
              {list.map((b) => (
                <Link key={b.id} href={`/list?brand=${b.id}`} className={styles.brand}>
                  <span className={styles.logo} aria-hidden="true">
                    {b.name_en.charAt(0)}
                  </span>
                  <span>
                    <span className={styles.name}>{b.name_en}</span>
                    <span className={styles.origin}>
                      {[b.name_ko, b.origin_country].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </Link>
              ))}
            </section>
          ))}
        </div>

        <nav className={styles.index} aria-label="알파벳 바로가기">
          {LETTERS.map((l) =>
            available.has(l) ? (
              <a key={l} href={`#letter-${l}`} className={styles.on}>
                {l}
              </a>
            ) : (
              <span key={l}>{l}</span>
            ),
          )}
        </nav>
      </div>
    </>
  );
}
