import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import SubTopBar from "@/components/SubTopBar";
import { getSessionUser } from "@/lib/auth/session";
import { getMyInquiry } from "@/lib/support";
import { sinceLabel } from "@/lib/format";
import styles from "../support.module.css";

export const metadata = { title: "1:1 문의 · Real HAVE" };

async function Content({ params }: { params: PageProps<"/support/[id]">["params"] }) {
  const [{ id }, user] = await Promise.all([params, getSessionUser()]);
  if (!user) redirect("/login?next=/support");
  const q = await getMyInquiry(id, user.id);
  if (!q) notFound();
  return (
    <article className={styles.article}>
      <span className={`${styles.tag} ${q.status === "answered" ? styles.tagWine : ""}`}>
        {q.status === "answered" ? "답변완료" : "답변대기"}
      </span>
      <h1>{q.title}</h1>
      <div className={styles.date}>{sinceLabel(q.created_at)}</div>
      <div className={styles.body}>{q.body}</div>
      {q.answer ? (
        <div className={styles.answer}>
          <b>리얼해브 답변{q.answered_at && ` · ${sinceLabel(q.answered_at)}`}</b>
          {q.answer}
        </div>
      ) : (
        <p className={styles.hint}>아직 답변을 준비 중이에요.</p>
      )}
    </article>
  );
}

export default function InquiryPage(props: PageProps<"/support/[id]">) {
  return (
    <>
      <SubTopBar title="1:1 문의" fallback="/support" />
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content params={props.params} />
      </Suspense>
    </>
  );
}
