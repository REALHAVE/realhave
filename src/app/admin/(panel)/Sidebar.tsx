"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminLogout } from "../actions";
import styles from "../admin.module.css";

type Role = "master" | "product" | "cs";

// 목업 사이드바. 권한에 맞는 메뉴만 보여줌 (실제 차단은 DB가 함)
const MENU: { href: string; label: string; roles: Role[] | "all"; exact?: boolean }[] = [
  { href: "/admin", label: "대시보드", roles: "all", exact: true },
  { href: "/admin/products", label: "상품 관리", roles: ["product"] },
  { href: "/admin/catalog", label: "카테고리/브랜드", roles: ["product"] },
  { href: "/admin/members", label: "회원 관리", roles: ["cs"] },
  { href: "/admin/deals", label: "거래관리", roles: "all" },
  { href: "/admin/reports", label: "신고/CS 관리", roles: ["cs"] },
  { href: "/admin/notices", label: "공지사항/이벤트", roles: ["cs"] },
  { href: "/admin/settings", label: "계정/권한 설정", roles: [] }, // master 전용
];

export default function Sidebar({ role }: { role: Role }) {
  const path = usePathname();
  const allowed = (r: Role[] | "all") => r === "all" || role === "master" || r.includes(role);

  return (
    <nav className={styles.sidebar}>
      <Link href="/admin" className={styles.sbLogo}>
        Real<span>HAVE</span>
        <small>Admin</small>
      </Link>
      {MENU.filter((m) => allowed(m.roles)).map((m) => {
        const active = m.exact ? path === m.href : path.startsWith(m.href);
        return (
          <Link key={m.href} href={m.href} className={`${styles.sbItem} ${active ? styles.sbActive : ""}`}>
            {m.label}
          </Link>
        );
      })}
      <Link href="/" className={styles.sbItem} style={{ marginTop: 24, fontSize: 12 }}>
        리얼해브 홈 ↗
      </Link>
      <form action={adminLogout}>
        <button className={styles.sbLogout}>로그아웃</button>
      </form>
    </nav>
  );
}
