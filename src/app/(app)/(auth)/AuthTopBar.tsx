import Link from "next/link";
import styles from "./auth.module.css";

export default function AuthTopBar({ title, back }: { title: string; back: string }) {
  return (
    <div className={styles.topbar}>
      <Link href={back} className={styles.backBtn} aria-label="뒤로">
        ←
      </Link>
      <h1 className={styles.title}>{title}</h1>
    </div>
  );
}
