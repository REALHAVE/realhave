import { Suspense } from "react";
import VerifyForm from "./VerifyForm";

export const metadata = { title: "이메일 인증 · Real HAVE" };

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
