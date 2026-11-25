import Link from "next/link";
import { Suspense } from "react";
import { listNoticesAdmin } from "@/lib/admin-data";
import { NoPermission, requireAdmin } from "../Guard";
import styles from "../../admin.module.css";

export const metadata = { title: "공지사항/이벤트 · 관리자" };

const ymd = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }).replace(/\s/g, "").replace(/\.$/, "");

async function Content({ searchParams }: { searchParams: PageProps<"/admin/notices">["searchParams"] }) {
  const [admin, sp] = await Promise.all([requireAdmin("cs"), searchParams]);
  if (!admin) return <NoPermission />;
  const rows = await listNoticesAdmin();

  return (
    <>
      {sp.saved === "1" && <p className={styles.flash}>저장했어요.</p>}
      {sp.deleted === "1" && <p className={styles.flash}>삭제했어요.</p>}
      <div className={styles.panel}>
        {rows.length === 0 ? (
          <p className={styles.empty}>작성한 글이 없어요. 오른쪽 위 &lsquo;새 글 작성&rsquo;을 눌러보세요.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr><th>구분</th><th>제목</th><th>등록일</th><th>상태</th></tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id}>
                  <td>{n.kind === "event" ? "이벤트" : "공지"}</td>
                  <td><Link className={styles.name} href={`/admin/notices/${n.id}`}>{n.title}</Link></td>
                  <td>{ymd(n.published_at ?? n.created_at)}</td>
                  <td>
                    <span className={`${styles.badge} ${n.is_published ? styles.ok : styles.muted}`}>
                      {n.is_published ? "게시중" : "임시저장"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className={styles.note}>※ 게시중인 글은 회원 화면의 공지사항에 보여요 (회원용 공지 화면은 11단계).</p>
      </div>
    </>
  );
}

export default function NoticesPage(props: PageProps<"/admin/notices">) {
  return (
    <>
      <div className={styles.topbar}>
        <h1>공지사항/이벤트</h1>
        <Link href="/admin/notices/new" className={`${styles.btn} ${styles.primary}`}>새 글 작성</Link>
      </div>
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
