import { redirect } from "next/navigation";
import { Suspense } from "react";
import SubTopBar from "@/components/SubTopBar";
import { getSessionUser } from "@/lib/auth/session";
import { getReportTarget } from "@/lib/support";
import ReportForm from "./ReportForm";
import styles from "../support/support.module.css";

export const metadata = { title: "신고하기 · Real HAVE" };

// /report?product=<상품ID>  또는  /report?room=<채팅방ID>
async function Content({ searchParams }: { searchParams: PageProps<"/report">["searchParams"] }) {
  const [user, sp] = await Promise.all([getSessionUser(), searchParams]);
  const kind = typeof sp.room === "string" ? "chat" : "product";
  const id = String((kind === "chat" ? sp.room : sp.product) ?? "");
  if (!user) redirect(`/login?next=${encodeURIComponent(`/report?${kind === "chat" ? "room" : "product"}=${id}`)}`);

  const target = await getReportTarget(kind, id, user.id);
  if (!target) return <p className={styles.empty}>신고할 수 없는 대상이에요.</p>;

  return (
    <>
      <p className={styles.target}>신고 대상: {target.label}</p>
      <ReportForm kind={target.kind} targetId={target.id} />
    </>
  );
}

export default function ReportPage(props: PageProps<"/report">) {
  return (
    <>
      <SubTopBar title="신고하기" />
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
