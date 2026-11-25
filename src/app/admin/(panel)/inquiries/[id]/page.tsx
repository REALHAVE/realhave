import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { listInquiries, timeAgo } from "@/lib/admin-data";
import { isUuid } from "@/lib/catalog";
import { NoPermission, requireAdmin } from "../../Guard";
import AnswerForm from "./AnswerForm";
import styles from "../../../admin.module.css";

export const metadata = { title: "1:1 문의 · 관리자" };

async function Content({ params }: { params: PageProps<"/admin/inquiries/[id]">["params"] }) {
  const [{ id }, admin] = await Promise.all([params, requireAdmin("cs")]);
  if (!admin) return <NoPermission />;
  if (!isUuid(id)) notFound();
  const q = (await listInquiries()).find((x) => x.id === id);
  if (!q) notFound();

  return (
    <div className={styles.reviewGrid}>
      <section className={styles.panel}>
        <h2>{q.title}</h2>
        <p className={styles.note} style={{ marginTop: 0 }}>
          {q.writer} · {timeAgo(q.created_at)}
        </p>
        <p style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.7, marginTop: 12 }}>{q.body}</p>
      </section>
      <section className={styles.panel}>
        <h2>답변 {q.answered_at && <span className={styles.more}>{timeAgo(q.answered_at)} 답변</span>}</h2>
        <AnswerForm inquiryId={q.id} answer={q.answer ?? ""} />
      </section>
    </div>
  );
}

export default function InquiryPage(props: PageProps<"/admin/inquiries/[id]">) {
  return (
    <>
      <div className={styles.topbar}>
        <h1>1:1 문의</h1>
        <Link href="/admin/reports" className={`${styles.btn} ${styles.ghost}`}>← 목록으로</Link>
      </div>
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content params={props.params} />
      </Suspense>
    </>
  );
}
