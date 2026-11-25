import Link from "next/link";
import { Suspense } from "react";
import { listDeals, timeAgo, type DealRow } from "@/lib/admin-data";
import { formatPrice } from "@/lib/format";
import { NoPermission, requireAdmin } from "../Guard";
import styles from "../../admin.module.css";

export const metadata = { title: "거래관리 · 관리자" };

const STATE: Record<DealRow["state"], { label: string; cls: string }> = {
  chatting: { label: "채팅중", cls: "wait" },
  done: { label: "거래완료", cls: "ok" },
  done_no_buyer: { label: "거래완료 (구매자 미선택)", cls: "ok" },
  done_other: { label: "다른 구매자와 완료", cls: "muted" },
  closed: { label: "판매 종료", cls: "muted" },
};

async function Content({ searchParams }: { searchParams: PageProps<"/admin/deals">["searchParams"] }) {
  const [admin, sp] = await Promise.all([requireAdmin(), searchParams]);
  if (!admin) return <NoPermission />;
  const all = await listDeals();
  const filter = sp.state === "chatting" || sp.state === "done" ? sp.state : "all";
  const rows = all.filter((r) =>
    filter === "all" ? true : filter === "chatting" ? r.state === "chatting" : r.state.startsWith("done"),
  );
  const count = (f: string) =>
    f === "chatting" ? all.filter((r) => r.state === "chatting").length : all.filter((r) => r.state.startsWith("done")).length;

  return (
    <>
      <div className={styles.tabs}>
        <Link href="/admin/deals" className={`${styles.tab} ${filter === "all" ? styles.tabOn : ""}`}>전체 {all.length}</Link>
        <Link href="/admin/deals?state=chatting" className={`${styles.tab} ${filter === "chatting" ? styles.tabOn : ""}`}>
          채팅중 {count("chatting")}
        </Link>
        <Link href="/admin/deals?state=done" className={`${styles.tab} ${filter === "done" ? styles.tabOn : ""}`}>
          거래완료 {count("done")}
        </Link>
      </div>

      <div className={styles.panel}>
        {rows.length === 0 ? (
          <p className={styles.empty}>해당하는 거래가 없어요.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr><th>상품</th><th>구매(희망)자</th><th>판매자</th><th>거래방식</th><th>금액</th><th>진행상태</th><th>최근</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const st = STATE[r.state];
                return (
                  <tr key={r.room_id ?? `${r.product_id}-${i}`}>
                    <td>
                      <Link className={styles.name} href={`/admin/products/${r.product_id}`}>{r.product}</Link>
                      {r.reported && <span className={`${styles.badge} ${styles.bad}`} style={{ marginLeft: 6 }}>신고됨</span>}
                    </td>
                    <td>{r.buyer ?? "-"}</td>
                    <td>{r.seller}</td>
                    <td>{r.method ?? "-"}</td>
                    <td>{formatPrice(r.price)}</td>
                    <td><span className={`${styles.badge} ${styles[st.cls]}`}>{st.label}</span></td>
                    <td>{r.last_message_at ? timeAgo(r.last_message_at) : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className={styles.note}>
          ※ 채팅 내용은 보이지 않아요 (결정 9). 신고된 대화만 신고/CS 관리에서 볼 수 있어요.
        </p>
      </div>
    </>
  );
}

export default function DealsPage(props: PageProps<"/admin/deals">) {
  return (
    <>
      <div className={styles.topbar}>
        <h1>거래관리</h1>
      </div>
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
