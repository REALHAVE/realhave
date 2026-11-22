import { redirect } from "next/navigation";

// 대시보드는 10단계. 지금은 상품 관리로 바로 이동
export default function AdminHome() {
  redirect("/admin/products");
}
