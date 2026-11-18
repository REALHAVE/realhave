import Placeholder from "@/components/Placeholder";
import styles from "../tabs.module.css";

export default function DesignersPage() {
  return (
    <>
      <header className={styles.topbar}>
        <h1 className={`${styles.title} display`}>A-Z Designers</h1>
      </header>
      <Placeholder title="A-Z 브랜드" step="5단계" />
    </>
  );
}
