import { Suspense } from "react";
import AdminLoginForm from "./AdminLoginForm";

export const metadata = { title: "관리자 로그인 · Real HAVE" };

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  );
}
