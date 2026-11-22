"use client";

import { useRouter } from "next/navigation";
import styles from "./TopBar.module.css";

// 이전 화면으로. 바로 이 주소로 들어온 경우(이전 화면 없음)에는 fallback 주소로
export default function BackButton({
  fallback = "/",
  className,
}: {
  fallback?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className ?? styles.backBtn}
      aria-label="뒤로"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      ←
    </button>
  );
}
