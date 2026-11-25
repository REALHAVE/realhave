import { Suspense } from "react";
import { ROLE_NAME } from "@/lib/auth/admin";
import { listAdmins, timeAgo } from "@/lib/admin-data";
import { NoPermission, requireAdmin } from "../Guard";
import { AddAdminForm, RemoveAdminButton } from "./AdminForms";
import styles from "../../admin.module.css";

export const metadata = { title: "계정/권한 설정 · 관리자" };

async function Content() {
  const admin = await requireAdmin("master");
  if (!admin) return <NoPermission />;
  const admins = await listAdmins();

  return (
    <>
      <section className={styles.panel}>
        <h2>관리자 {admins.length}명</h2>
        <table className={styles.table}>
          <thead>
            <tr><th>관리자</th><th>이메일</th><th>권한</th><th>최근 로그인</th><th></th></tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.user_id}>
                <td><b>{a.nickname}</b></td>
                <td>{a.email}</td>
                <td>{ROLE_NAME[a.role]}</td>
                <td>{a.last_sign_in_at ? timeAgo(a.last_sign_in_at) : "-"}</td>
                <td>
                  {a.user_id === admin.id ? (
                    <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>본인</span>
                  ) : (
                    <RemoveAdminButton userId={a.user_id} nickname={a.nickname} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.panel} style={{ maxWidth: 640 }}>
        <h2>관리자 추가 / 권한 변경</h2>
        <AddAdminForm />
        <p className={styles.note}>
          ※ 먼저 리얼해브에 <b>회원가입</b>한 이메일만 지정할 수 있어요. 이미 관리자인 이메일을 넣으면 권한이 바뀌어요.
          <br />· 전체 관리자: 모든 메뉴 · 상품 관리자: 정품인증 심사·카테고리/브랜드 · 신고·CS 관리자: 회원 조회·신고·문의·공지
        </p>
      </section>
    </>
  );
}

export default function SettingsPage() {
  return (
    <>
      <div className={styles.topbar}>
        <h1>계정/권한 설정</h1>
      </div>
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
