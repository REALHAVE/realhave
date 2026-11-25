import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import SubTopBar from "@/components/SubTopBar";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import WithdrawConfirm from "./WithdrawConfirm";
import styles from "../support/support.module.css";

export const metadata = { title: "회원탈퇴 · Real HAVE" };

// 탈퇴 가능 조건: 판매중 상품 0개 + 처리 중인 신고 0건 (DB 함수가 한 번 더 확인)
// 하나라도 남아 있으면 경고 화면, 모두 없으면 "정말로 탈퇴하시겠습니까?"
async function Content() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/withdraw");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("withdraw_status");
  const row = (Array.isArray(data) ? data[0] : data) as { on_sale: number; open_reports: number } | null;
  if (error || !row) {
    return <p className={styles.empty}>탈퇴 가능 여부를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.</p>;
  }
  const { on_sale: onSale, open_reports: openReports } = row;

  if (onSale > 0 || openReports > 0) {
    return (
      <div className={styles.wd}>
        <div className={styles.wdIcon}>⚠️</div>
        {/* 신고 처리 중이면 신고 안내만, 신고가 없고 판매중 상품만 있으면 상품 삭제 안내만 */}
        <div className={styles.wdTitle}>
          {openReports > 0 ? "처리 중인 신고가 있어요" : "등록된 상품이 있어요"}
        </div>

        {openReports > 0 && (
          <div className={styles.wdWarn}>
            🚨 <b>처리 중인 신고 {openReports}건</b>
            <br />
            회원님과 관련된 신고(내가 한 신고 · 나에 대한 신고 · 내 대화에 대한 신고)를 리얼해브에서
            확인하고 있어요. <b>관리자가 처리를 마친 뒤에 탈퇴할 수 있어요.</b>
            <br />
            <small>급한 경우 고객센터 1:1 문의로 알려주세요.</small>
          </div>
        )}

        {openReports === 0 && onSale > 0 && (
          <>
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
          </>
        )}

        {openReports > 0 && (
          <Link href="/support" className={styles.btn}>고객센터 1:1 문의</Link>
        )}
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
