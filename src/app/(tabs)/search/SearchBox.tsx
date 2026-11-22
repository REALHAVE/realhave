"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import styles from "./search.module.css";

const RECENT_KEY = "realhave:recent-searches";
const RECENT_MAX = 10;

// 최근검색어는 이 기기(브라우저)에만 저장 (설계안 1-7)
const listeners = new Set<() => void>();

function readRaw(): string {
  try {
    return localStorage.getItem(RECENT_KEY) ?? "[]";
  } catch {
    return "[]"; // 저장이 막힌 브라우저(사생활 보호 모드 등)
  }
}

function parse(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // 무시
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export default function SearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  const recent = useMemo(() => parse(raw), [raw]);

  function search(q: string) {
    const term = q.trim();
    if (!term) return;
    writeRecent([term, ...parse(readRaw()).filter((r) => r !== term)].slice(0, RECENT_MAX));
    setValue(term);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  function remove(term: string) {
    writeRecent(parse(readRaw()).filter((r) => r !== term));
  }

  return (
    <>
      <form
        className={styles.topbar}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          search(value);
        }}
      >
        <input
          className={styles.input}
          type="search"
          enterKeyHint="search"
          placeholder="브랜드, 상품명으로 검색"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={50}
          autoFocus={!initial}
        />
        <button
          type="button"
          className={styles.cancel}
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
        >
          취소
        </button>
      </form>

      {!initial && (
        <section className={styles.block}>
          <h2>최근 검색어</h2>
          {recent.length === 0 ? (
            <p className={styles.hint}>최근 검색한 내역이 없어요.</p>
          ) : (
            <div className={styles.chips}>
              {recent.map((r) => (
                <span key={r} className={styles.chip}>
                  <button type="button" onClick={() => search(r)}>
                    {r}
                  </button>
                  <button
                    type="button"
                    className={styles.chipX}
                    aria-label={`${r} 삭제`}
                    onClick={() => remove(r)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}
