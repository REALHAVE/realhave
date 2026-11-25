import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getReportedChat, listReports, REPORT_REASON, REPORT_TARGET, timeAgo } from "@/lib/admin-data";
import { isUuid } from "@/lib/catalog";
import { NoPermission, requireAdmin } from "../../Guard";
import HandleForm from "./HandleForm";
import styles from "../../../admin.module.css";

export const metadata = { title: "신고 처리 · 관리자" };

async function Content({ params }: { params: PageProps<"/admin/reports/[id]">["params"] }) {
  const [{ id }, admin] = await Promise.all([params, requireAdmin("cs")]);
  if (!admin) return <NoPermission />;
  if (!isUuid(id)) notFound();

  const r = (await listReports()).find((x) => x.id === id);
  if (!r) notFound();
  const chat = r.room_id ? await getReportedChat(r.room_id) : null;

  return (
    <div className={styles.reviewGrid}>
      <div>
        <section className={styles.panel}>
          <h2>신고 내용</h2>
          <dl className={styles.info}>
            <div><dt>구분</dt><dd>{REPORT_TARGET[r.target_type]} 신고</dd></div>
            <div><dt>사유</dt><dd>{REPORT_REASON[r.reason]}</dd></div>
            <div><dt>상세</dt><dd>{r.detail || "-"}</dd></div>
            <div><dt>신고자</dt><dd>{r.reporter}</dd></div>
            <div><dt>대상 회원</dt><dd>{r.target_user ?? "-"}</dd></div>
            <div>
              <dt>대상 상품</dt>
              <dd>
                {r.product_id ? (
                  <Link href={`/admin/products/${r.product_id}`} className={styles.name}>{r.product}</Link>
                ) : "-"}
              </dd>
            </div>
            <div><dt>접수</dt><dd>{timeAgo(r.created_at)}</dd></div>
          </dl>
          {r.target_user_id && (
            <p className={styles.note}>
              회원 자격중지가 필요하면 <Link href={`/admin/members?q=${encodeURIComponent(r.target_user ?? "")}`}>회원 관리</Link>에서 처리하세요.
            </p>
          )}
        </section>

        {r.room_id && (
          <section className={styles.panel}>
            <h2>신고된 대화</h2>
            {!chat || chat.messages.length === 0 ? (
              <p className={styles.empty}>대화 내용이 없어요.</p>
            ) : (
              <div className={styles.chatLog}>
                {chat.messages.map((m) => (
                  <div key={m.id} className={`${styles.chatLine} ${m.isSeller ? styles.chatSeller : ""}`}>
                    <span className={styles.chatMeta}>
                      {m.sender}{m.isSeller ? " (판매자)" : " (구매희망자)"} ·{" "}
                      {new Date(m.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                    </span>
                    {m.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.imageUrl} alt="보낸 사진" />
                    ) : (
                      m.body
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className={styles.note}>※ 신고된 대화만 볼 수 있어요. 사진 링크는 10분 뒤 만료돼요.</p>
          </section>
        )}
      </div>

      <section className={styles.panel}>
        <h2>처리</h2>
        <HandleForm reportId={r.id} status={r.status} note={r.admin_note ?? ""} />
      </section>
    </div>
  );
}

export default function ReportDetailPage(props: PageProps<"/admin/reports/[id]">) {
  return (
    <>
      <div className={styles.topbar}>
        <h1>신고 처리</h1>
        <Link href="/admin/reports" className={`${styles.btn} ${styles.ghost}`}>← 목록으로</Link>
      </div>
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content params={props.params} />
      </Suspense>
    </>
  );
}
