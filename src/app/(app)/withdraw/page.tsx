import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import SubTopBar from "@/components/SubTopBar";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import WithdrawConfirm from "./WithdrawConfirm";
import styles from "../support/support.module.css";

export const metadata = { title: "회원탈퇴 · Real HAVE" };

// 목업: 판매중 상품이 있으면 "등록된 상품이 있어요", 없으면 "정말로 탈퇴하시겠습니까?"
async function Content() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/withdraw");

  const supabase = await createClient();
  const { data } = await supabase.rpc("withdraw_check");
  const onSale = (data as number | null) ?? 0;

  if (onSale > 0) {
    return (
      <div className={styles.wd}>
        <div className={styles.wdIcon}>⚠️</div>
        <div className={styles.wdTitle}>등록된 상품이 있어요</div>
        <div className={styles.wdDesc}>
          회원탈퇴를 진행하려면
          <br />
          판매중인 상품을 먼저 삭제해주세요.
          <br />
          <small>(심사대기·반려 상품도 포함돼요)</small>
        </div>
        <div className={styles.wdCount}>
          판매중 상품 <b>{onSale}개</b>
        </div>
        <Link href="/sales" className={styles.btn}>판매내역에서 상품 삭제하기</Link>
        <Link href="/mypage" className={styles.wdNo}>돌아가기</Link>
      </div>
    );
  }

  return <WithdrawConfirm userId={user.id} />;
}

export default function WithdrawPage() {
  return (
    <>
      <SubTopBar title="회원탈퇴" fallback="/mypage" />
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
