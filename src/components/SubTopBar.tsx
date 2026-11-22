import BackButton from "./BackButton";
import styles from "./TopBar.module.css";

export default function SubTopBar({ title, fallback }: { title: string; fallback?: string }) {
  return (
    <header className={styles.subbar}>
      <BackButton fallback={fallback} />
      <h1 className={styles.subTitle}>{title}</h1>
    </header>
  );
}
