"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./TabBar.module.css";

type Tab = { href: string; label: string; icon: React.ReactNode };

const TABS: Tab[] = [
  {
    href: "/",
    label: "Home",
    icon: (
      <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />
    ),
  },
  {
    href: "/category",
    label: "Category",
    icon: (
      <>
        <rect x="4" y="4" width="7" height="7" rx="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" />
      </>
    ),
  },
  {
    href: "/designers",
    label: "A-Z Designers",
    icon: (
      <>
        <path d="M4 19 8 6l4 13M5.5 14.5h5" />
        <path d="M14 7h6l-6 12h6" />
      </>
    ),
  },
  {
    href: "/mypage",
    label: "My page",
    icon: (
      <>
        <circle cx="12" cy="8.5" r="3.5" />
        <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
      </>
    ),
  },
];

export default function TabBar() {
  const pathname = usePathname();
  // 로그인 기능은 4단계에서 연결. 지금은 항상 비회원으로 표시
  const isLoggedIn = false;

  return (
    <nav className={styles.tabbar} aria-label="하단 메뉴">
      {TABS.map((tab) => {
        const active =
          tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${styles.tab} ${active ? styles.active : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <svg
              className={styles.icon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {tab.icon}
            </svg>
            <span>
              {tab.label}
              {tab.href === "/mypage" && !isLoggedIn && (
                <span className={styles.sub}> (Log in)</span>
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
