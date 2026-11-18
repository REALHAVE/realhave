import Link from "next/link";
import Placeholder from "@/components/Placeholder";
import styles from "./tabs.module.css";

export default function HomePage() {
  return (
    <>
      <header className={styles.topbar}>
        <h1 className={styles.logo}>
          <span className={styles.rAccent}>R</span>eal HAVE
        </h1>
        {/* 비회원이면 proxy.ts 가 로그인 화면으로 보냄 */}
        <Link href="/sell" className={styles.sellBtn}>상품등록</Link>
      </header>
      <Placeholder title="홈" step="5단계(홈·검색·상품 화면)" />
    </>
  );
}
