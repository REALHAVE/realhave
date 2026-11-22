import { Suspense } from "react";
import { ProductList } from "@/components/catalog/ProductRow";
import TopBar from "@/components/TopBar";
import { listProducts } from "@/lib/catalog";
import SearchBox from "./SearchBox";
import styles from "./search.module.css";

export const metadata = { title: "검색 · Real HAVE" };

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 50);

  return (
    <>
      <SearchBox initial={q} />
      {q && <ResultList q={q} />}
    </>
  );
}

async function ResultList({ q }: { q: string }) {
  const { items, count } = await listProducts({ query: q });
  return (
    <>
      <p className={styles.count}>
        &apos;<b>{q}</b>&apos; 검색결과 <b>{count.toLocaleString("ko-KR")}</b>건
      </p>
      <ProductList
        items={items}
        empty="검색 결과가 없어요. 브랜드명(영문/한글)이나 상품명으로 다시 검색해 보세요."
      />
    </>
  );
}

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <>
      <TopBar />
      <Suspense fallback={<SearchBox initial="" />}>
        <Results searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
