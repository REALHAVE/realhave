import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { can, getAdmin } from "@/lib/auth/admin";
import { getReviewDetail, timeAgo } from "@/lib/admin-data";
import { isUuid, productImageUrl } from "@/lib/catalog";
import { formatPrice, sizeLabel } from "@/lib/format";
import ReviewForm from "./ReviewForm";
import styles from "../../../admin.module.css";

export const metadata = { title: "정품인증 심사 · 관리자" };

const REVIEW_STATUS: Record<string, string> = {
  pending: "대기",
  needs_check: "재확인 필요",
  approved: "승인",
  rejected: "반려",
};

async function Content({ params }: { params: PageProps<"/admin/products/[id]">["params"] }) {
  const [{ id }, admin] = await Promise.all([params, getAdmin()]);
  if (typeof admin === "string" || !can(admin, "product"))
    return <p className={styles.empty}>상품 관리 권한이 없어요.</p>;
  if (!isUuid(id)) notFound();

  const d = await getReviewDetail(id);
  if (!d) notFound();
  const p = d.product;
  const canDecide = p.status === "on_sale" && p.auth_status === "pending";

  return (
    <div className={styles.reviewGrid}>
      <div>
        <section className={styles.panel}>
          <h2>정품인증 서류 (원본 · 비공개)</h2>
          {d.certs.length === 0 ? (
            <p className={styles.empty}>등록된 인증 사진이 없어요.</p>
          ) : (
            <div className={styles.certs}>
              {d.certs.map((c, i) => (
                <div key={i} className={styles.cert}>
                  {c.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.url} alt={`${c.kind} 사진`} />
                  ) : (
                    <p className={styles.empty}>사진을 불러오지 못했어요</p>
                  )}
                  <div className={styles.certKind}>
                    {c.kind}
                    {c.url && (
                      <a href={c.url} target="_blank" rel="noreferrer">
                        크게 보기 ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className={styles.note}>
            ※ 원본에는 가격·카드번호가 보일 수 있어요. 이 화면은 관리자만 볼 수 있고, 링크는 10분 뒤
            만료됩니다. 한글택·인보이스의 브랜드·구매처가 아래 상품 정보와 맞는지 확인해 주세요.
          </p>
        </section>

        <section className={styles.panel}>
          <h2>상품 사진 ({p.images.length}장)</h2>
          <div className={styles.photos}>
            {p.images.map((path) => (
              <a key={path} href={productImageUrl(path)} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={productImageUrl(path)} alt="" />
              </a>
            ))}
          </div>
        </section>
      </div>

      <div>
        <section className={styles.panel}>
          <h2>{canDecide ? "심사하기" : "심사 결과"}</h2>
          {canDecide ? (
            <ReviewForm productId={p.id} />
          ) : (
            <p className={styles.note} style={{ marginTop: 0 }}>
              현재 상태:{" "}
              <b>
                {p.status === "sold"
                  ? "거래완료"
                  : p.auth_status === "approved"
                    ? "승인됨 (공개중)"
                    : p.auth_status === "rejected"
                      ? "반려됨"
                      : "심사대기"}
              </b>
            </p>
          )}
        </section>

        <section className={styles.panel}>
          <h2>상품 정보</h2>
          <dl className={styles.info}>
            <div><dt>제목</dt><dd>{p.title}</dd></div>
            <div><dt>브랜드</dt><dd>{p.brand_name}</dd></div>
            <div><dt>카테고리</dt><dd>{p.top_category_name} &gt; {p.category_name}</dd></div>
            <div><dt>구매처</dt><dd>{p.purchase_place_name}</dd></div>
            <div><dt>사이즈</dt><dd>{sizeLabel(p.size)}</dd></div>
            <div><dt>상태등급</dt><dd>{p.condition_grade}</dd></div>
            <div><dt>거래방식</dt><dd>{p.tradeMethods.join(", ") || "-"}</dd></div>
            <div><dt>색상</dt><dd>{p.colors.join(", ") || "-"}</dd></div>
            <div><dt>가격</dt><dd>{formatPrice(p.price)}</dd></div>
            <div><dt>설명</dt><dd>{p.description || "-"}</dd></div>
          </dl>
        </section>

        <section className={styles.panel}>
          <h2>판매자</h2>
          <dl className={styles.info}>
            <div><dt>닉네임</dt><dd>{d.seller?.nickname ?? "-"}</dd></div>
            <div>
              <dt>상태</dt>
              <dd>{d.seller?.status === "suspended" ? "자격중지" : "정상"}</dd>
            </div>
            <div>
              <dt>가입</dt>
              <dd>{d.seller ? new Date(d.seller.created_at).toLocaleDateString("ko-KR") : "-"}</dd>
            </div>
          </dl>
        </section>

        <section className={styles.panel}>
          <h2>심사 이력</h2>
          {d.reviews.length === 0 ? (
            <p className={styles.empty}>이력이 없어요.</p>
          ) : (
            <ul className={styles.history}>
              {d.reviews.map((r) => (
                <li key={r.id}>
                  <b>{REVIEW_STATUS[r.status] ?? r.status}</b> · 요청 {timeAgo(r.createdAt)}
                  {r.decidedAt && ` · 처리 ${timeAgo(r.decidedAt)}`}
                  {r.reviewer && ` · ${r.reviewer}`}
                  {r.reason && <div>사유: {r.reason}</div>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ReviewPage(props: PageProps<"/admin/products/[id]">) {
  return (
    <>
      <div className={styles.topbar}>
        <h1>정품인증 심사</h1>
        <Link href="/admin/products" className={`${styles.btn} ${styles.ghost}`}>
          ← 목록으로
        </Link>
      </div>
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content params={props.params} />
      </Suspense>
    </>
  );
}
