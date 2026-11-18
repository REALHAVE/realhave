import Placeholder from "@/components/Placeholder";
import styles from "../tabs.module.css";

export default function CategoryPage() {
  return (
    <>
      <header className={styles.topbar}>
        <h1 className={styles.title}>카테고리</h1>
      </header>
      <Placeholder title="카테고리" step="5단계" />
    </>
  );
}
