import Link from "next/link";
import { Suspense } from "react";
import { getDashboard, listPendingProducts, timeAgo } from "@/lib/admin-data";
import { formatPrice } from "@/lib/format";
import { requireAdmin } from "./Guard";
import styles from "../admin.module.css";

export const metadata = { title: "대시보드 · 관리자" };

async function Content() {
  const admin = await requireAdmin();
  if (!admin) return null;
  const [d, pending] = await Promise.all([
    getDashboard(),
    admin.role === "master" || admin.role === "product" ? listPendingProducts() : Promise.resolve([]),
  ]);
  if (!d) return <p className={styles.empty}>대시보드를 불러오지 못했어요.</p>;

  const max = Math.max(1, ...d.weekly.map((w) => w.count));
  const dayName = (iso: string) => "일월화수목금토"[new Date(iso + "T00:00:00Z").getUTCDay()]; // 날짜만 보고 요일 계산

  return (
    <>
      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <div className={styles.kpiLbl}>오늘 신규 등록</div>
          <div className={styles.kpiVal}>{d.today_products}건</div>
          <div className={styles.kpiSub}>공개중 상품 {d.on_sale}개</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLbl}>오늘 신규 가입</div>
          <div className={styles.kpiVal}>{d.today_signups}명</div>
          <div className={styles.kpiSub}>전체 회원 {d.members}명</div>
        </div>
        <Link href="/admin/products" className={styles.kpi}>
          <div className={styles.kpiLbl}>정품인증 심사 대기</div>
          <div className={styles.kpiVal}>{d.pending}건</div>
          <div className={`${styles.kpiSub} ${d.pending_over24 ? styles.kpiWarn : ""}`}>
            {d.pending_over24 ? `⏱ 24시간 초과 ${d.pending_over24}건` : "24시간 초과 없음"}
          </div>
        </Link>
        <Link href="/admin/reports" className={styles.kpi}>
          <div className={styles.kpiLbl}>미처리 신고 · 답변대기 문의</div>
          <div className={styles.kpiVal}>
            {d.open_reports}건 · {d.waiting_inquiries}건
          </div>
          <div className={`${styles.kpiSub} ${d.open_reports ? styles.kpiWarn : ""}`}>
            {d.open_reports ? "우선 확인 필요" : "밀린 신고 없음"}
          </div>
        </Link>
      </div>

      <div className={styles.grid2}>
        <section className={styles.panel}>
          <h2>주간 신규 등록 추이 <small className={styles.more}>최근 7일</small></h2>
          <div className={styles.chart} role="img"
            aria-label={d.weekly.map((w) => `${dayName(w.day)} ${w.count}건`).join(", ")}>
            {d.weekly.map((w) => (
              <div key={w.day} className={styles.barCol}>
                <span className={styles.barNum}>{w.count}</span>
                <div className={styles.bar} style={{ height: `${(w.count / max) * 100}%` }} />
                <span className={styles.barDay}>{dayName(w.day)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          <h2>
            정품인증 심사 대기 <Link href="/admin/products" className={styles.more}>전체보기 ›</Link>
          </h2>
          {pending.length === 0 ? (
            <p className={styles.empty}>심사를 기다리는 상품이 없어요.</p>
          ) : (
            pending.slice(0, 5).map((p) => (
              <Link key={p.id} href={`/admin/products/${p.id}`} className={styles.queue}>
                <div>
                  <div className={styles.queueName}>{p.brand_name} {p.title}</div>
                  <div className={styles.queueMeta}>판매자 {p.seller_nickname} · {timeAgo(p.created_at)}</div>
                </div>
                <span className={`${styles.badge} ${styles.wait}`}>대기중</span>
              </Link>
            ))
          )}
        </section>
      </div>

      <section className={styles.panel}>
        <h2>
          최근 거래완료 <Link href="/admin/deals" className={styles.more}>전체보기 ›</Link>
        </h2>
        {d.recent_deals.length === 0 ? (
          <p className={styles.empty}>아직 거래완료가 없어요.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr><th>상품</th><th>구매자</th><th>판매자</th><th>금액</th><th>완료</th></tr>
            </thead>
            <tbody>
              {d.recent_deals.map((r, i) => (
                <tr key={i}>
                  <td>{r.product}</td>
                  <td>{r.buyer ?? "(선택 안 함)"}</td>
                  <td>{r.seller}</td>
                  <td>{formatPrice(r.price)}</td>
                  <td>{timeAgo(r.completed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

export default function DashboardPage() {
  return (
    <>
      <div className={styles.topbar}>
        <h1>대시보드</h1>
      </div>
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
