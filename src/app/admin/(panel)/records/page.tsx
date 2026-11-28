import Link from "next/link";
import { Suspense } from "react";
import { listLegalRecords, type LegalRecord } from "@/lib/admin-data";
import { formatPrice, ymdLabel } from "@/lib/format";
import { NoPermission, requireAdmin } from "../Guard";
import PurgeButton from "./PurgeButton";
import styles from "../../admin.module.css";

export const metadata = { title: "법정 보관 기록 · 관리자" };

const KIND: Record<LegalRecord["kind"], { label: string; period: string }> = {
  contract: { label: "계약·거래", period: "5년" },
  dispute: { label: "불만·분쟁", period: "3년" },
  ad: { label: "표시·광고", period: "6개월" },
};

const SOURCE: Record<string, string> = {
  deals: "거래완료",
  inquiries: "1:1 문의",
  reports: "신고",
  support_threads: "관리자 대화",
  products: "상품 글",
};

// 기록 한 줄 요약
function summary(r: LegalRecord) {
  const d = r.data as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (r.source_table === "deals")
    return `${d.product?.brand ?? ""} ${d.product?.title ?? ""} · ${formatPrice(Number(d.price ?? 0))} · 판매 ${d.seller?.nickname ?? "-"} → 구매 ${d.buyer?.nickname ?? "(선택 안 함)"}`;
  if (r.source_table === "products") return `${d.brand ?? ""} ${d.title ?? ""} · ${formatPrice(Number(d.price ?? 0))}`;
  if (r.source_table === "inquiries") return `문의: ${d.title ?? ""}`;
  if (r.source_table === "reports") return `신고: ${d.reason ?? ""} · ${d.product ?? d.target_user ?? ""}`;
  if (r.source_table === "support_threads") return `관리자 대화: ${d.subject ?? ""}`;
  return "-";
}

async function Content({ searchParams }: { searchParams: PageProps<"/admin/records">["searchParams"] }) {
  const [admin, sp] = await Promise.all([requireAdmin("master"), searchParams]);
  if (!admin) return <NoPermission />;
  const kind = sp.kind === "contract" || sp.kind === "dispute" || sp.kind === "ad" ? sp.kind : undefined;
  const rows = await listLegalRecords(kind);
  const expired = rows.filter((r) => r.expired).length;

  return (
    <>
      <div className={styles.tabs}>
        <Link href="/admin/records" className={`${styles.tab} ${!kind ? styles.tabOn : ""}`}>전체</Link>
        {(Object.keys(KIND) as LegalRecord["kind"][]).map((k) => (
          <Link key={k} href={`/admin/records?kind=${k}`} className={`${styles.tab} ${kind === k ? styles.tabOn : ""}`}>
            {KIND[k].label} ({KIND[k].period})
          </Link>
        ))}
      </div>

      <section className={styles.panel}>
        <h2>
          보관 기록 {rows.length}건
          <span className={styles.more}>보존기간 지남 {expired}건</span>
        </h2>
        {rows.length === 0 ? (
          <p className={styles.empty}>보관 중인 기록이 없어요. 회원이 탈퇴하거나 회원을 삭제하면 여기에 쌓여요.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr><th>구분</th><th>내용</th><th>탈퇴 회원</th><th>보관 시작</th><th>보관 기한</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.expired ? styles.muteRow : ""}>
                  <td>
                    <span className={`${styles.badge} ${styles.muted}`}>{KIND[r.kind].label}</span>
                    <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4 }}>{SOURCE[r.source_table] ?? r.source_table}</div>
                  </td>
                  <td style={{ maxWidth: 380 }}>{summary(r)}</td>
                  <td>{r.subject_name ?? "-"}<div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{r.reason}</div></td>
                  <td>{ymdLabel(r.recorded_at)}</td>
                  <td>
                    {ymdLabel(r.retain_until)}
                    {r.expired && <div className={styles.inlineErr}>기한 지남</div>}
                  </td>
                  <td>
                    <details>
                      <summary style={{ cursor: "pointer", fontSize: 12 }}>원문 보기</summary>
                      <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, maxWidth: 420, maxHeight: 300, overflow: "auto", background: "var(--admin-bg)", padding: 8, borderRadius: 6 }}>
                        {JSON.stringify(r.data, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.panel} style={{ maxWidth: 720 }}>
        <h2>보존기간이 지난 기록 파기</h2>
        <p className={styles.note} style={{ marginTop: 0 }}>
          전자상거래법 제6조·시행령 제6조 제1항: 계약·청약철회 / 대금결제·재화공급 기록 5년, 소비자 불만·분쟁처리 기록
          3년, 표시·광고 기록 6개월. 기한이 지난 기록은 지체 없이 파기해야 해요 (개인정보 보호법). 주기적으로(예: 매월 1일) 눌러주세요.
        </p>
        <PurgeButton expired={expired} />
      </section>
    </>
  );
}

export default function RecordsPage(props: PageProps<"/admin/records">) {
  return (
    <>
      <div className={styles.topbar}>
        <h1>법정 보관 기록</h1>
      </div>
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
