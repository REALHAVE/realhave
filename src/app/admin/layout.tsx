import styles from "./admin.module.css";

export const metadata = { title: "관리자 · Real HAVE" };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.root}>{children}</div>;
}
