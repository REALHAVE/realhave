import TabBar from "@/components/TabBar";
import styles from "./tabs.module.css";

// 하단 탭이 있는 화면들 (홈 · 카테고리 · A-Z · 마이페이지)
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className={styles.content}>{children}</main>
      <TabBar />
    </>
  );
}
