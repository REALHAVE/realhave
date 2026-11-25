import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import SupportChat from "@/components/SupportChat";
import { getSupportThread } from "@/lib/chat";
import { NoPermission, requireAdmin } from "../../Guard";
import styles from "../../../admin.module.css";

export const metadata = { title: "관리자 채팅 · 관리자" };

async function Content({ params }: { params: PageProps<"/admin/threads/[id]">["params"] }) {
  const [{ id }, admin] = await Promise.all([params, requireAdmin("cs")]);
  if (!admin) return <NoPermission />;
  const t = await getSupportThread(id);
  if (!t) notFound();

  return (
    <>
      <p className={styles.note} style={{ marginTop: 0, marginBottom: 12 }}>
        <b>{t.nickname}</b>님과의 대화 · {t.subject}
        {t.reportId && (
          <> · <Link href={`/admin/reports/${t.reportId}`} className={styles.name}>관련 신고 보기</Link></>
        )}
        <br />이 대화는 해당 회원과 신고/CS 관리자만 볼 수 있어요. 회원 화면에는 &lsquo;리얼해브 관리자&rsquo;로 표시돼요.
      </p>
      <SupportChat threadId={t.id} myId={admin.id} viewer="admin" otherName={t.nickname} initial={t.messages} />
    </>
  );
}

export default function ThreadPage(props: PageProps<"/admin/threads/[id]">) {
  return (
    <>
      <div className={styles.topbar}>
        <h1>관리자 채팅</h1>
        <Link href="/admin/threads" className={`${styles.btn} ${styles.ghost}`}>← 목록으로</Link>
      </div>
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content params={props.params} />
      </Suspense>
    </>
  );
}
