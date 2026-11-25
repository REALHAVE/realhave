import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getNoticeAdmin } from "@/lib/admin-data";
import { isUuid } from "@/lib/catalog";
import { NoPermission, requireAdmin } from "../../Guard";
import NoticeForm from "./NoticeForm";
import styles from "../../../admin.module.css";

export const metadata = { title: "공지 작성 · 관리자" };

// /admin/notices/new = 새 글, /admin/notices/<id> = 수정
async function Content({ params }: { params: PageProps<"/admin/notices/[id]">["params"] }) {
  const [{ id }, admin] = await Promise.all([params, requireAdmin("cs")]);
  if (!admin) return <NoPermission />;
  if (id === "new") return <NoticeForm />;
  if (!isUuid(id)) notFound();
  const n = await getNoticeAdmin(id);
  if (!n) notFound();
  return <NoticeForm notice={n} />;
}

export default function NoticeEditPage(props: PageProps<"/admin/notices/[id]">) {
  return (
    <>
      <div className={styles.topbar}>
        <h1>공지사항/이벤트 작성</h1>
        <Link href="/admin/notices" className={`${styles.btn} ${styles.ghost}`}>← 목록으로</Link>
      </div>
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content params={props.params} />
      </Suspense>
    </>
  );
}
