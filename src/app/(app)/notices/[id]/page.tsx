import { notFound } from "next/navigation";
import { Suspense } from "react";
import SubTopBar from "@/components/SubTopBar";
import { getNotice } from "@/lib/support";
import { ymdLabel as ymd } from "@/lib/format";
import styles from "../../support/support.module.css";

export const metadata = { title: "공지사항 · Real HAVE" };

async function Content({ params }: { params: PageProps<"/notices/[id]">["params"] }) {
  const { id } = await params;
  const n = await getNotice(id);
  if (!n) notFound();
  return (
    <article className={styles.article}>
      <span className={`${styles.tag} ${n.kind === "event" ? styles.tagBrass : styles.tagWine}`}>
        {n.kind === "event" ? "이벤트" : "공지"}
      </span>
      <h1>{n.title}</h1>
      <div className={styles.date}>{ymd(n.published_at ?? n.created_at)}</div>
      <div className={styles.body}>{n.body}</div>
    </article>
  );
}

export default function NoticePage(props: PageProps<"/notices/[id]">) {
  return (
    <>
      <SubTopBar title="공지사항" fallback="/notices" />
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content params={props.params} />
      </Suspense>
    </>
  );
}
