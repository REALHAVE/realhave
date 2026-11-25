import Link from "next/link";
import { Suspense } from "react";
import SubTopBar from "@/components/SubTopBar";
import { safeNext } from "@/lib/auth/validation";
import styles from "../../support/support.module.css";

export const metadata = { title: "신고 완료 · Real HAVE" };

async function Back({ searchParams }: { searchParams: PageProps<"/report/done">["searchParams"] }) {
  const sp = await searchParams;
  return (
    <Link href={safeNext(sp.back, "/")} className={styles.btn}>
      돌아가기
    </Link>
  );
}

export default function ReportDonePage(props: PageProps<"/report/done">) {
  return (
    <>
      <SubTopBar title="신고하기" fallback="/" />
      <div className={styles.wd}>
        <div className={styles.wdIcon}>✅</div>
        <div className={styles.wdTitle}>신고가 접수되었어요</div>
        <div className={styles.wdDesc}>
          리얼해브 관리자가 확인 후 조치할게요.
          <br />
          알려주셔서 감사합니다.
        </div>
        <Suspense>
          <Back searchParams={props.searchParams} />
        </Suspense>
      </div>
    </>
  );
}
