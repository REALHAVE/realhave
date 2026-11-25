import Link from "next/link";
import { Suspense } from "react";
import { listSupportThreads, timeAgo } from "@/lib/admin-data";
import { NoPermission, requireAdmin } from "../Guard";
import styles from "../../admin.module.css";

export const metadata = { title: "관리자 채팅 · 관리자" };

async function Content() {
  const admin = await requireAdmin("cs");
  if (!admin) return <NoPermission />;
  const threads = await listSupportThreads();

  return (
    <div className={styles.panel}>
      {threads.length === 0 ? (
        <p className={styles.empty}>
          관리자 대화가 없어요. 신고 처리 화면의 &lsquo;채팅하기&rsquo;로 시작할 수 있어요.
        </p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr><th>회원</th><th>주제</th><th>마지막 메시지</th><th>최근</th><th></th></tr>
          </thead>
          <tbody>
            {threads.map((t) => (
              <tr key={t.thread_id}>
                <td>
                  <b>{t.nickname}</b>
                  {t.unread > 0 && (
                    <span className={`${styles.badge} ${styles.bad}`} style={{ marginLeft: 6 }}>새 {t.unread}</span>
                  )}
                </td>
                <td>
                  {t.subject}
                  {t.report_id && (
                    <> · <Link href={`/admin/reports/${t.report_id}`} className={styles.name}>신고 보기</Link></>
                  )}
                </td>
                <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.last_message ?? "(아직 메시지 없음)"}
                </td>
                <td>{t.last_message_at ? timeAgo(t.last_message_at) : "-"}</td>
                <td>
                  <Link href={`/admin/threads/${t.thread_id}`} className={`${styles.btn} ${styles.small} ${styles.primary}`}>
                    열기
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ThreadsPage() {
  return (
    <>
      <div className={styles.topbar}>
        <h1>관리자 채팅</h1>
      </div>
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
