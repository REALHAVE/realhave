import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import SubTopBar from "@/components/SubTopBar";
import { getSessionUser } from "@/lib/auth/session";
import { getEditData, getSellOptions } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import SellForm from "../../../sell/SellForm";
import styles from "../../../sell/sell.module.css";

export const metadata = { title: "게시글 수정 · Real HAVE" };

async function EditContent({
  params,
  searchParams,
}: {
  params: PageProps<"/sales/[id]/edit">["params"];
  searchParams: PageProps<"/sales/[id]/edit">["searchParams"];
}) {
  const [{ id }, sp, user] = await Promise.all([params, searchParams, getSessionUser()]);
  if (!user) redirect(`/login?next=/sales/${id}/edit`);

  const supabase = await createClient();
  const [initial, options, reportedRes] = await Promise.all([
    getEditData(id, user.id),
    getSellOptions(),
    supabase.rpc("my_reported_products"),
  ]);
  // 신고 처리 중인 상품은 수정 불가 (DB에서도 막음)
  if (((reportedRes.data ?? []) as string[]).includes(id)) {
    return (
      <p className={styles.blocked}>
        🚨 신고 처리 중인 상품이에요.
        <br />
        리얼해브 관리자의 확인이 끝난 뒤 수정할 수 있어요.
        <br />
        <Link href="/sales">판매내역으로</Link>
      </p>
    );
  }
  if (!initial) {
    return (
      <p className={styles.blocked}>
        수정할 수 없는 상품이에요. (내 판매중 상품만 수정할 수 있어요)
        <br />
        <Link href="/sales">판매내역으로</Link>
      </p>
    );
  }

  return (
    <>
      {sp.relisted === "1" && (
        <p className={styles.blocked} style={{ padding: "8px 20px 0", textAlign: "left" }}>
          새 글로 복사했어요. 가격 등을 확인하고 <b>수정 완료</b>를 누르면 심사를 거쳐 공개돼요.
        </p>
      )}
      <SellForm options={options} initial={initial} />
    </>
  );
}

export default function EditPage(props: PageProps<"/sales/[id]/edit">) {
  return (
    <>
      <SubTopBar title="게시글 수정" fallback="/sales" />
      <Suspense fallback={<p className={styles.blocked}>불러오는 중…</p>}>
        <EditContent params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
