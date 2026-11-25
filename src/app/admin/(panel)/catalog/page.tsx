import Link from "next/link";
import { Fragment, Suspense } from "react";
import { getCatalogAdmin } from "@/lib/admin-data";
import { NoPermission, requireAdmin } from "../Guard";
import { BrandForm, CategoryForm, ToggleActive } from "./CatalogForms";
import styles from "../../admin.module.css";

export const metadata = { title: "카테고리/브랜드 · 관리자" };

const SIZE_NAME: Record<string, string> = {
  none: "사이즈 없음",
  clothing: "의류 (44~115)",
  shoes: "신발 (180~300)",
  kids: "유아동 (80~160)",
};

async function Content() {
  const admin = await requireAdmin("product");
  if (!admin) return <NoPermission />;
  const { categories, brands } = await getCatalogAdmin();

  return (
    <>
      <div className={styles.tabs}>
        <Link href="/admin/products" className={styles.tab}>정품인증 심사대기</Link>
        <Link href="/admin/products?tab=all" className={styles.tab}>전체 상품</Link>
        <span className={`${styles.tab} ${styles.tabOn}`}>카테고리/브랜드</span>
      </div>

      <section className={styles.panel}>
        <h2>카테고리 (대분류 {categories.filter((c) => c.is_active).length}개)</h2>
        <table className={styles.table}>
          <thead>
            <tr><th>대분류 / 소분류</th><th>사이즈</th><th>상품수</th><th>관리</th></tr>
          </thead>
          <tbody>
            {categories.map((top) => (
              <Fragment key={top.id}>
                <tr className={top.is_active ? "" : styles.muteRow}>
                  <td><b>{top.name}</b>{!top.is_active && " (숨김)"}</td>
                  <td>{SIZE_NAME[top.size_type]}</td>
                  <td>{top.count}</td>
                  <td>
                    <CategoryForm category={{ id: top.id, name: top.name, size_type: top.size_type }} />
                    <ToggleActive kind="category" id={top.id} active={top.is_active} />
                  </td>
                </tr>
                {top.children.map((c) => (
                  <tr key={c.id} className={c.is_active ? "" : styles.muteRow}>
                    <td style={{ paddingLeft: 24 }}>└ {c.name}{!c.is_active && " (숨김)"}</td>
                    <td></td>
                    <td>{c.count}</td>
                    <td>
                      <CategoryForm category={{ id: c.id, name: c.name, parent_id: top.id }} />
                      <ToggleActive kind="category" id={c.id} active={c.is_active} />
                    </td>
                  </tr>
                ))}
                <tr key={`${top.id}-add`}>
                  <td colSpan={4} style={{ paddingLeft: 24 }}>
                    <CategoryForm parentId={top.id} parentName={top.name} />
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 14 }}>
          <CategoryForm />
        </div>
        <p className={styles.note}>
          ※ 상품이 연결돼 있을 수 있어 <b>삭제 대신 숨김</b>으로 처리해요. 숨기면 회원 화면(카테고리·상품등록)에서 안 보여요.
          <br />※ 대분류의 사이즈 종류를 바꾸면 소분류에도 같이 적용돼요. 이미 등록된 상품의 사이즈는 그대로예요.
        </p>
      </section>

      <section className={styles.panel}>
        <h2>브랜드 ({brands.filter((b) => b.is_active).length}개)</h2>
        <BrandForm />
        <table className={styles.table} style={{ marginTop: 10 }}>
          <thead>
            <tr><th>브랜드</th><th>한글명</th><th>국가</th><th>인기브랜드</th><th>상품수</th><th>관리</th></tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id} className={b.is_active ? "" : styles.muteRow}>
                <td><b>{b.name_en}</b>{!b.is_active && " (숨김)"}</td>
                <td>{b.name_ko ?? "-"}</td>
                <td>{b.origin_country ?? "-"}</td>
                <td>{b.is_popular ? `홈 ${b.popular_order ?? "-"}번째` : "-"}</td>
                <td>{b.count}</td>
                <td>
                  <BrandForm brand={b} />
                  <ToggleActive kind="brand" id={b.id} active={b.is_active} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.note}>
          ※ 한글명을 넣어두면 &ldquo;에르메스&rdquo;처럼 한글로도 검색돼요. 인기브랜드는 홈에 최대 9개, 순서 번호 작은 순으로 보여요.
        </p>
      </section>
    </>
  );
}

export default function CatalogPage() {
  return (
    <>
      <div className={styles.topbar}>
        <h1>카테고리/브랜드</h1>
      </div>
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
