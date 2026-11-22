import { Suspense } from "react";
import { ProductList } from "@/components/catalog/ProductRow";
import SubTopBar from "@/components/SubTopBar";
import { getBrand, getCategory, isUuid, listProducts } from "@/lib/catalog";
import styles from "../search/search.module.css";

export const metadata = { title: "상품 목록 · Real HAVE" };

// 주소 예: /list?category=…  /list?brand=…  /list?latest=1
async function ListContent({ searchParams }: { searchParams: PageProps<"/list">["searchParams"] }) {
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : undefined;
  const brand = typeof sp.brand === "string" ? sp.brand : undefined;

  let title = "최신등록상품";
  let filter: Parameters<typeof listProducts>[0] = { limit: 20 };

  if (category && isUuid(category)) {
    const c = await getCategory(category);
    title = c?.fullName ?? "카테고리";
    filter = { categoryId: category };
  } else if (brand && isUuid(brand)) {
    const b = await getBrand(brand);
    title = b?.name_en ?? "브랜드";
    filter = { brandId: brand };
  }

  const { items, count } = await listProducts(filter);

  return (
    <>
      <SubTopBar title={title} />
      <p className={styles.count}>
        <b>{count.toLocaleString("ko-KR")}</b>건의 상품
      </p>
      <ProductList items={items} empty="아직 등록된 상품이 없어요." />
    </>
  );
}

export default function ListPage(props: PageProps<"/list">) {
  return (
    <Suspense fallback={<SubTopBar title="" />}>
      <ListContent searchParams={props.searchParams} />
    </Suspense>
  );
}
