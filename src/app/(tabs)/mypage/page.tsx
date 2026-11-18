import Placeholder from "@/components/Placeholder";
import styles from "../tabs.module.css";

export default function MyPage() {
  return (
    <>
      <header className={styles.topbar}>
        <h1 className={styles.title}>마이페이지</h1>
      </header>
      <Placeholder title="마이페이지 · 로그인" step="4단계(회원가입·로그인)" />
    </>
  );
}
