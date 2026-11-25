import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import SubTopBar from "@/components/SubTopBar";
import SupportChat from "@/components/SupportChat";
import { getSessionUser } from "@/lib/auth/session";
import { getSupportThread } from "@/lib/chat";
import styles from "../../chat.module.css";

export const metadata = { title: "리얼해브 관리자 · Real HAVE" };

// 회원 화면: 리얼해브 관리자와의 1:1 대화 (본인만 — RLS)
async function Content({ params }: { params: PageProps<"/chat/support/[threadId]">["params"] }) {
  const [{ threadId }, user] = await Promise.all([params, getSessionUser()]);
  if (!user) redirect(`/login?next=/chat/support/${threadId}`);
  const t = await getSupportThread(threadId);
  if (!t || t.userId !== user.id) notFound();

  return (
    <>
      <div className={styles.roomHead}>
        <SubTopBar title="리얼해브 관리자" fallback="/chat" />
        <p className={styles.guide}>🛡 {t.subject} — 리얼해브 관리자와 나만 볼 수 있는 대화예요.</p>
      </div>
      <SupportChat threadId={t.id} myId={user.id} viewer="user" otherName={t.nickname} initial={t.messages} />
    </>
  );
}

export default function SupportThreadPage(props: PageProps<"/chat/support/[threadId]">) {
  return (
    <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
      <Content params={props.params} />
    </Suspense>
  );
}
