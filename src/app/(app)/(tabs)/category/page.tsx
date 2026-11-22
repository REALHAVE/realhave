import Link from "next/link";
import { Fragment, Suspense } from "react";
import TopBar from "@/components/TopBar";
import { getCategoryTree } from "@/lib/catalog";
import styles from "./category.module.css";

export const metadata = { title: "카테고리 · Real HAVE" };

async function CategoryList() {
  const tree = await getCategoryTree();
  return (
    <div className={styles.list}>
      {tree.map((top) => (
        <section key={top.id} className={styles.group}>
          <h2>
            <Link href={`/list?category=${top.id}`}>{top.name}</Link>
          </h2>
          <p className={styles.items}>
            {top.children.map((c, i) => (
              <Fragment key={c.id}>
                {i > 0 && ", "}
                <Link href={`/list?category=${c.id}`} className={styles.sub}>
                  {c.name}
                </Link>
              </Fragment>
            ))}
          </p>
        </section>
      ))}
    </div>
  );
}

export default function CategoryPage() {
  return (
    <>
      <TopBar bordered />
      <Suspense fallback={<p className={styles.loading}>불러오는 중…</p>}>
        <CategoryList />
      </Suspense>
    </>
  );
}
