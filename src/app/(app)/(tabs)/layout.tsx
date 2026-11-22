import { Suspense } from "react";
import TabBar from "@/components/TabBar";
import { getSessionUser } from "@/lib/auth/session";
import styles from "./tabs.module.css";

async function TabBarWithSession() {
  const user = await getSessionUser();
  return <TabBar isLoggedIn={Boolean(user)} />;
}

// 하단 탭이 있는 화면들 (홈 · 카테고리 · A-Z · 마이페이지)
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className={styles.content}>{children}</main>
      {/* 로그인 여부 확인 전에는 "(Log in)" 표시 없이 먼저 보여줌 */}
      <Suspense fallback={<TabBar isLoggedIn={null} />}>
        <TabBarWithSession />
      </Suspense>
    </>
  );
}
