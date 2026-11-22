import { Suspense } from "react";
import TopBar from "@/components/TopBar";
import { getAllBrands } from "@/lib/catalog";
import DesignerList from "./DesignerList";
import styles from "./designers.module.css";

export const metadata = { title: "A-Z Designers · Real HAVE" };

async function Brands() {
  const brands = await getAllBrands();
  return <DesignerList brands={brands} />;
}

export default function DesignersPage() {
  return (
    <>
      <TopBar bordered />
      <Suspense
        fallback={
          <div className={styles.header}>
            <h1 className={styles.title}>A-Z Designers</h1>
          </div>
        }
      >
        <Brands />
      </Suspense>
    </>
  );
}
