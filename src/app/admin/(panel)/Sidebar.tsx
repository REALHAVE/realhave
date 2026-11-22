"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminLogout } from "../actions";
import styles from "../admin.module.css";

// 목업 사이드바. 아직 안 만든 메뉴는 "10단계" 표시
const MENU = [
  { href: "/admin/products", label: "상품 관리" },
  { href: null, label: "대시보드" },
  { href: null, label: "회원 관리" },
  { href: null, label: "거래관리" },
  { href: null, label: "신고/CS 관리" },
  { href: null, label: "공지사항/이벤트" },
  { href: null, label: "계정/권한 설정" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <nav className={styles.sidebar}>
      <Link href="/admin" className={styles.sbLogo}>
        Real<span>HAVE</span>
        <small>Admin</small>
      </Link>
      {MENU.map((m) =>
        m.href ? (
          <Link key={m.label} href={m.href}
            className={`${styles.sbItem} ${path.startsWith(m.href) ? styles.sbActive : ""}`}>
            {m.label}
          </Link>
        ) : (
          <span key={m.label} className={`${styles.sbItem} ${styles.sbSoon}`}>
            {m.label}
            <small>10단계</small>
          </span>
        ),
      )}
      <form action={adminLogout}>
        <button className={styles.sbLogout}>로그아웃</button>
      </form>
    </nav>
  );
}
