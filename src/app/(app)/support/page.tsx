import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import SubTopBar from "@/components/SubTopBar";
import { getSessionUser } from "@/lib/auth/session";
import { listMyInquiries } from "@/lib/support";
import { sinceLabel } from "@/lib/format";
import styles from "./support.module.css";

export const metadata = { title: "고객센터 · Real HAVE" };

async function Content({ searchParams }: { searchParams: PageProps<"/support">["searchParams"] }) {
  const [user, sp] = await Promise.all([getSessionUser(), searchParams]);
  if (!user) redirect("/login?next=/support");
  const items = await listMyInquiries(user.id);

  return (
    <>
      {sp.sent === "1" && <p className={styles.flash}>문의를 보냈어요. 답변이 등록되면 여기에서 확인할 수 있어요.</p>}
      <div className={styles.top}>
        <Link href="/support/new" className={styles.btn}>1:1 문의하기</Link>
      </div>
      {items.length === 0 ? (
        <p className={styles.empty}>문의 내역이 없어요.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((q) => (
            <li key={q.id}>
              <Link href={`/support/${q.id}`} className={styles.row}>
                <div className={styles.rowTop}>
                  <span className={`${styles.tag} ${q.status === "answered" ? styles.tagWine : ""}`}>
                    {q.status === "answered" ? "답변완료" : "답변대기"}
                  </span>
                  <span className={styles.date}>{sinceLabel(q.created_at)}</span>
                </div>
                <div className={styles.title}>{q.title}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function SupportPage(props: PageProps<"/support">) {
  return (
    <>
      <SubTopBar title="고객센터 · 1:1 문의" fallback="/mypage" />
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
