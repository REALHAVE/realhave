import Link from "next/link";
import { Suspense } from "react";
import SubTopBar from "@/components/SubTopBar";
import { ymdLabel as ymd } from "@/lib/format";
import { listNotices } from "@/lib/support";
import styles from "../support/support.module.css";

export const metadata = { title: "공지사항 · Real HAVE" };


async function Content() {
  const notices = await listNotices();
  if (notices.length === 0) return <p className={styles.empty}>등록된 공지사항이 없어요.</p>;
  return (
    <ul className={styles.list}>
      {notices.map((n) => (
        <li key={n.id}>
          <Link href={`/notices/${n.id}`} className={styles.row}>
            <div className={styles.rowTop}>
              <span className={`${styles.tag} ${n.kind === "event" ? styles.tagBrass : styles.tagWine}`}>
                {n.kind === "event" ? "이벤트" : "공지"}
              </span>
              <span className={styles.date}>{ymd(n.published_at ?? n.created_at)}</span>
            </div>
            <div className={styles.title}>{n.title}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function NoticesPage() {
  return (
    <>
      <SubTopBar title="공지사항" fallback="/mypage" />
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
