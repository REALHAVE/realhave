import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import Thumb from "@/components/catalog/Thumb";
import SubTopBar from "@/components/SubTopBar";
import { getSessionUser } from "@/lib/auth/session";
import { getProductDetail, isUuid } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import CompleteForm from "./CompleteForm";
import styles from "../../sales.module.css";

export const metadata = { title: "구매자 선택 · Real HAVE" };

// 목업 "구매자 선택". 채팅(8단계) 전이라 지금은 "선택하지 않을래요"만 가능
async function Content({ params }: { params: PageProps<"/sales/[id]/complete">["params"] }) {
  const [{ id }, user] = await Promise.all([params, getSessionUser()]);
  if (!user) redirect(`/login?next=/sales/${id}/complete`);
  if (!isUuid(id)) notFound();

  const p = await getProductDetail(id);
  if (!p || p.seller_id !== user.id || p.status !== "on_sale") {
    return <p className={styles.empty}>판매중인 내 상품만 거래완료로 바꿀 수 있어요.</p>;
  }

  return (
    <>
      <div className={styles.buyerItem}>
        <Thumb path={p.images[0] ?? null} brand={p.brand_name} className={styles.thumb} />
        <div className={styles.info}>
          <div className={styles.n}>
            {p.brand_name} {p.title}
          </div>
          <div className={styles.p}>{formatPrice(p.price)}</div>
        </div>
      </div>

      <div className={styles.findLink}>
        최근 채팅 목록에서 구매자 찾기
        <br />
        <small>(채팅 기능을 만든 뒤 연결돼요)</small>
      </div>

      <CompleteForm productId={p.id} />

      <p className={styles.hint}>
        구매자를 선택하면 구매자의 &lsquo;구매내역&rsquo;에도 기록돼요. 지금은 채팅 기능 준비 중이라
        구매자 없이 거래완료로만 바꿀 수 있어요.
      </p>
    </>
  );
}

export default function CompletePage(props: PageProps<"/sales/[id]/complete">) {
  return (
    <>
      <SubTopBar title="구매자 선택" fallback="/sales" />
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content params={props.params} />
      </Suspense>
    </>
  );
}
