import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import SubTopBar from "@/components/SubTopBar";
import { getSessionUser } from "@/lib/auth/session";
import { listMyProducts } from "@/lib/catalog";
import { bumpWaitHours, sinceLabel } from "@/lib/format";
import SalesCard from "./SalesCard";
import styles from "./sales.module.css";

export const metadata = { title: "판매내역 · Real HAVE" };

const FLASH: Record<string, string> = {
  created: "상품이 등록되었어요! 정품인증 심사가 끝나면 다른 회원에게 공개돼요.",
  updated: "수정했어요.",
  completed: "거래완료로 바꿨어요.",
};

async function SalesContent({ searchParams }: { searchParams: PageProps<"/sales">["searchParams"] }) {
  const [user, sp] = await Promise.all([getSessionUser(), searchParams]);
  if (!user) redirect("/login?next=/sales");

  const all = await listMyProducts(user.id);
  const ongoing = all.filter((p) => p.status === "on_sale");
  const done = all.filter((p) => p.status === "sold");
  const tab = sp.tab === "done" ? "done" : "ongoing";
  const items = tab === "done" ? done : ongoing;
  const flash = Object.keys(FLASH).find((k) => sp[k] === "1");

  return (
    <>
      {flash && <p className={styles.success}>{FLASH[flash]}</p>}

      <div className={styles.tabs}>
        <Link href="/sales" replace className={`${styles.tab} ${tab === "ongoing" ? styles.tabOn : ""}`}>
          판매중 {ongoing.length}
        </Link>
        <Link href="/sales?tab=done" replace className={`${styles.tab} ${tab === "done" ? styles.tabOn : ""}`}>
          거래완료 {done.length}
        </Link>
      </div>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <p>{tab === "done" ? "거래완료된 상품이 없어요." : "판매중인 상품이 없어요."}</p>
          {tab === "ongoing" && (
            <Link href="/sell" className={styles.btn}>상품 등록하기</Link>
          )}
        </div>
      ) : (
        <div className={styles.list}>
          {items.map((p) => (
            <SalesCard
              key={p.id}
              p={p}
              meta={
                p.status === "sold" && p.sold_at
                  ? `거래완료 · ${sinceLabel(p.sold_at)}`
                  : `등록 ${sinceLabel(p.bumped_at)}`
              }
              bumpWait={bumpWaitHours(p.bumped_at)}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default function SalesPage(props: PageProps<"/sales">) {
  return (
    <>
      <SubTopBar title="판매내역" fallback="/mypage" />
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <SalesContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
