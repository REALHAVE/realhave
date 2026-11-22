import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import BackButton from "@/components/BackButton";
import { getLatestRejectReason } from "@/lib/admin-data";
import { getSessionUser } from "@/lib/auth/session";
import { getProductDetail, isUuid } from "@/lib/catalog";
import { formatPrice, sizeLabel } from "@/lib/format";
import PhotoSlider from "./PhotoSlider";
import styles from "./detail.module.css";

export const metadata = { title: "상품 상세 · Real HAVE" };

const AUTH_NOTICE: Record<string, string> = {
  pending: "정품인증 심사 중이에요. 승인 전까지 다른 회원에게는 보이지 않아요.",
  rejected: "정품인증이 반려되었어요. 아래 사유를 확인해 주세요. (상품 수정 후 재심사 요청은 9단계에서 연결)",
};

async function Detail({ params }: { params: PageProps<"/products/[id]">["params"] }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const [p, user] = await Promise.all([getProductDetail(id), getSessionUser()]);
  if (!p || p.status === "deleted") notFound();

  const isMine = user?.id === p.seller_id;
  const rejectReason =
    isMine && p.auth_status === "rejected" ? await getLatestRejectReason(p.id) : null;
  const loginHref = `/login?next=${encodeURIComponent(`/products/${p.id}`)}`;

  return (
    <>
      <div className={styles.topbar}>
        <BackButton className={styles.iconBtn} fallback="/" />
      </div>

      <PhotoSlider paths={p.images} brand={p.brand_name} />

      {isMine && AUTH_NOTICE[p.auth_status] && (
        <p className={styles.notice}>
          {AUTH_NOTICE[p.auth_status]}
          {rejectReason && (
            <>
              <br />
              <b>반려 사유:</b> {rejectReason}
            </>
          )}
        </p>
      )}

      <div className={styles.main}>
        <div className={styles.brand}>{p.brand_name}</div>
        <h1 className={styles.name}>{p.title}</h1>
        <div className={styles.price}>{formatPrice(p.price)}</div>
      </div>

      <dl className={styles.info}>
        <Row k="브랜드" v={p.brand_name} />
        <Row k="카테고리" v={`${p.top_category_name} > ${p.category_name}`} />
        <Row k="구매처" v={p.purchase_place_name} />
        <Row k="사이즈" v={sizeLabel(p.size)} />
        <Row k="거래방식" v={p.tradeMethods.join(", ") || "-"} />
        <Row k="상태등급" v={p.condition_grade} />
        <Row
          k="색상"
          v={
            <>
              {p.colors.join(", ") || "-"}{" "}
              <span className={styles.caveat}>(등록상품과 다를 수 있음)</span>
            </>
          }
        />
        <Row k="판매가격" v={formatPrice(p.price)} />
      </dl>

      <section className={styles.desc}>
        <h2>내용</h2>
        <p>{p.description || "등록된 설명이 없어요."}</p>
      </section>

      <footer className={styles.footer}>
        {p.status === "sold" ? (
          <div className={styles.done}>거래완료</div>
        ) : isMine ? (
          <Link href="/chat" className={styles.btnFill}>
            메시지
          </Link>
        ) : (
          <div className={styles.actions}>
            {/* 찜·채팅 기능은 8단계에서 연결 */}
            <Link href={user ? "/wishlist" : loginHref} className={styles.btnLine}>
              ♡ 찜
            </Link>
            <Link href={user ? "/chat" : loginHref} className={styles.btnFill}>
              메시지
            </Link>
          </div>
        )}
      </footer>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

export default function ProductPage(props: PageProps<"/products/[id]">) {
  return (
    <Suspense fallback={<div className={styles.loading}>불러오는 중…</div>}>
      <Detail params={props.params} />
    </Suspense>
  );
}
