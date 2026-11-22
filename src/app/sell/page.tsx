import { redirect } from "next/navigation";
import { Suspense } from "react";
import SubTopBar from "@/components/SubTopBar";
import { getSessionUser } from "@/lib/auth/session";
import { getSellOptions } from "@/lib/catalog";
import SellForm from "./SellForm";
import styles from "./sell.module.css";

export const metadata = { title: "상품등록 · Real HAVE" };

// 로그인한 회원만 (proxy.ts가 먼저 막음)
async function SellContent() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/sell");

  if (user.status === "suspended") {
    return (
      <p className={styles.blocked}>
        이용이 제한된 계정이라 상품을 등록할 수 없어요.
        <br />
        고객센터로 문의해 주세요.
      </p>
    );
  }

  const options = await getSellOptions();
  return <SellForm options={options} />;
}

export default function SellPage() {
  return (
    <>
      <SubTopBar title="상품등록" fallback="/" />
      <Suspense fallback={<p className={styles.blocked}>불러오는 중…</p>}>
        <SellContent />
      </Suspense>
    </>
  );
}
