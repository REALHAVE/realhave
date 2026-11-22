import Link from "next/link";
import styles from "./TopBar.module.css";

// 탭 화면 공통 상단: 로고 · 찜 · 채팅 · 상품등록 (찜·채팅·등록은 로그인 필요 → proxy.ts)
export default function TopBar({ bordered = false }: { bordered?: boolean }) {
  return (
    <header className={`${styles.topbar} ${bordered ? styles.bordered : ""}`}>
      <Link href="/" className={styles.logo}>
        <span className={styles.rAccent}>R</span>eal HAVE
      </Link>
      <div className={styles.right}>
        <Link href="/wishlist" className={styles.iconBtn} aria-label="찜 목록">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
          </svg>
        </Link>
        <Link href="/chat" className={styles.iconBtn} aria-label="채팅">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 18.5V6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5v8a1.5 1.5 0 0 1-1.5 1.5H9z" />
          </svg>
        </Link>
        <Link href="/sell" className={styles.sellBtn}>
          상품등록
        </Link>
      </div>
    </header>
  );
}
