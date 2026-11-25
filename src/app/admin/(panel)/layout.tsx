import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAdmin, ROLE_NAME } from "@/lib/auth/admin";
import { adminLogout } from "../actions";
import Sidebar from "./Sidebar";
import styles from "../admin.module.css";

// 관리자만 들어올 수 있는 영역. 화면에서 막아도 실제 데이터는 DB 권한(RLS·함수)이 한 번 더 막음
async function AdminGate({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (admin === "guest") redirect("/admin/login");
  if (admin === "forbidden") {
    return (
      <div className={styles.center}>
        <p>관리자 권한이 없는 계정이에요.</p>
        <form action={adminLogout}>
          <button className={`${styles.btn} ${styles.primary}`}>다른 계정으로 로그인</button>
        </form>
        <Link href="/">리얼해브 홈으로</Link>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <Sidebar role={admin.role} />
      <main className={styles.main}>
        <p className={styles.who} style={{ textAlign: "right", marginBottom: 8 }}>
          <b>{admin.nickname}</b>님 ({ROLE_NAME[admin.role]})
        </p>
        {children}
      </main>
    </div>
  );
}

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className={styles.center}>불러오는 중…</div>}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
