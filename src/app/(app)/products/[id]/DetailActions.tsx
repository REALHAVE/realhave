"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./detail.module.css";

// 상품 상세 하단: 찜(♡) · 메시지(채팅 시작)
export default function DetailActions({
  productId,
  userId,
  initialWished,
  loginHref,
}: {
  productId: string;
  userId: string | null;
  initialWished: boolean;
  loginHref: string;
}) {
  const router = useRouter();
  const [wished, setWished] = useState(initialWished);
  const [busy, setBusy] = useState<"" | "wish" | "chat">("");
  const [error, setError] = useState("");

  if (!userId) {
    return (
      <div className={styles.actions}>
        <Link href={loginHref} className={styles.btnLine}>♡ 찜</Link>
        <Link href={loginHref} className={styles.btnFill}>메시지</Link>
      </div>
    );
  }

  async function toggleWish() {
    setBusy("wish");
    setError("");
    const supabase = createClient();
    const next = !wished;
    setWished(next); // 먼저 화면에 반영
    const { error: err } = next
      ? await supabase.from("wishlists").insert({ user_id: userId, product_id: productId })
      : await supabase.from("wishlists").delete().eq("user_id", userId).eq("product_id", productId);
    if (err && err.code !== "23505") {
      setWished(!next); // 실패하면 되돌림
      setError("찜하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    setBusy("");
  }

  async function startChat() {
    setBusy("chat");
    setError("");
    const { data, error: err } = await createClient().rpc("start_chat", { p_product_id: productId });
    if (err || !data) {
      setError(/[가-힣]/.test(err?.message ?? "") ? err!.message : "채팅을 시작하지 못했어요.");
      setBusy("");
      return;
    }
    router.push(`/chat/${data as string}`);
  }

  return (
    <>
      {error && <p className={styles.footerError}>{error}</p>}
      <div className={styles.actions}>
        <button type="button" className={`${styles.btnLine} ${wished ? styles.wished : ""}`}
          aria-pressed={wished} disabled={busy === "wish"} onClick={toggleWish}>
          {wished ? "♥ 찜" : "♡ 찜"}
        </button>
        <button type="button" className={styles.btnFill} disabled={busy === "chat"} onClick={startChat}>
          {busy === "chat" ? "여는 중…" : "메시지"}
        </button>
      </div>
    </>
  );
}
