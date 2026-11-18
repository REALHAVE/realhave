import Link from "next/link";
import Placeholder from "@/components/Placeholder";

export const metadata = { title: "상품등록 · Real HAVE" };

// 로그인한 회원만 들어올 수 있음 (proxy.ts). 실제 등록 화면은 6단계
export default function SellPage() {
  return (
    <div style={{ paddingTop: 16 }}>
      <Link href="/" style={{ padding: "0 20px", fontSize: 13, color: "var(--ink-soft)" }}>
        ← 홈으로
      </Link>
      <Placeholder title="상품등록" step="6단계" />
    </div>
  );
}
