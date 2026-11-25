import Link from "next/link";
import { Suspense } from "react";
import { listInquiries, listReports, REPORT_REASON, REPORT_TARGET, timeAgo } from "@/lib/admin-data";
import { NoPermission, requireAdmin } from "../Guard";
import styles from "../../admin.module.css";

export const metadata = { title: "신고/CS 관리 · 관리자" };

const REPORT_STATUS = {
  open: { label: "미처리", cls: "wait" },
  resolved: { label: "처리완료", cls: "ok" },
  dismissed: { label: "기각", cls: "muted" },
} as const;

async function Content() {
  const admin = await requireAdmin("cs");
  if (!admin) return <NoPermission />;
  const [reports, inquiries] = await Promise.all([listReports(), listInquiries()]);
  const open = reports.filter((r) => r.status === "open").length;
  const waiting = inquiries.filter((q) => q.status === "waiting").length;

  return (
    <>
      <section className={styles.panel}>
        <h2>
          신고 접수 <span className={styles.more}>{open}건 미처리</span>
        </h2>
        {reports.length === 0 ? (
          <p className={styles.empty}>접수된 신고가 없어요. (회원 신고하기는 11단계에서 열려요)</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr><th>구분</th><th>신고대상</th><th>사유</th><th>신고자</th><th>접수</th><th>상태</th><th></th></tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const st = REPORT_STATUS[r.status];
                return (
                  <tr key={r.id}>
                    <td>{REPORT_TARGET[r.target_type]}</td>
                    <td>{r.target_type === "user" ? r.target_user : r.product ?? r.target_user ?? "-"}</td>
                    <td>{REPORT_REASON[r.reason]}</td>
                    <td>{r.reporter}</td>
                    <td>{timeAgo(r.created_at)}</td>
                    <td><span className={`${styles.badge} ${styles[st.cls]}`}>{st.label}</span></td>
                    <td>
                      <Link href={`/admin/reports/${r.id}`} className={`${styles.btn} ${styles.small} ${styles.primary}`}>
                        {r.status === "open" ? "처리하기" : "보기"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.panel}>
        <h2>
          1:1 문의 <span className={styles.more}>{waiting}건 답변대기</span>
        </h2>
        {inquiries.length === 0 ? (
          <p className={styles.empty}>접수된 문의가 없어요. (회원 1:1 문의는 11단계에서 열려요)</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr><th>작성자</th><th>제목</th><th>접수</th><th>상태</th><th></th></tr>
            </thead>
            <tbody>
              {inquiries.map((q) => (
                <tr key={q.id}>
                  <td>{q.writer}</td>
                  <td>{q.title}</td>
                  <td>{timeAgo(q.created_at)}</td>
                  <td>
                    <span className={`${styles.badge} ${q.status === "waiting" ? styles.new : styles.ok}`}>
                      {q.status === "waiting" ? "답변대기" : "답변완료"}
                    </span>
                  </td>
                  <td>
                    <Link href={`/admin/inquiries/${q.id}`} className={`${styles.btn} ${styles.small} ${styles.primary}`}>
                      {q.status === "waiting" ? "답변하기" : "보기"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

export default function ReportsPage() {
  return (
    <>
      <div className={styles.topbar}>
        <h1>신고/CS 관리</h1>
      </div>
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
