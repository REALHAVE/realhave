"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../support/support.module.css";

type Supa = ReturnType<typeof createClient>;

// 폴더 안 파일 경로를 모두 모음 (회원ID/상품ID/파일 처럼 2단계까지)
async function listAll(supabase: Supa, bucket: string, prefix: string, depth = 2): Promise<string[]> {
  const { data } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  const out: string[] = [];
  for (const item of (data ?? []) as { name: string; id: string | null }[]) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) out.push(path); // 파일
    else if (depth > 0) out.push(...(await listAll(supabase, bucket, path, depth - 1))); // 폴더
  }
  return out;
}

async function removeAll(supabase: Supa, bucket: string, paths: string[]) {
  for (let i = 0; i < paths.length; i += 100) {
    await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
  }
}

export default function WithdrawConfirm({ userId }: { userId: string }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function withdraw() {
    setError("");
    const supabase = createClient();
    try {
      // 1) 마지막 확인 (그 사이 상품을 올렸을 수도 있으니)
      setBusy("확인 중…");
      const { data: left } = await supabase.rpc("withdraw_check");
      if ((left as number) > 0) throw new Error("판매중인 상품이 있어요. 먼저 삭제해주세요.");

      // 2) 내가 올린 사진 지우기 (상품사진은 공개 주소라 반드시 지움)
      setBusy("사진 정리 중…");
      await removeAll(supabase, "product-images", await listAll(supabase, "product-images", userId));
      await removeAll(supabase, "cert-docs", await listAll(supabase, "cert-docs", userId));
      // 채팅 사진 (신고된 대화는 증거로 남기므로 DB 규칙이 지우지 못하게 막음)
      const { data: rooms } = await supabase.rpc("my_chat_rooms");
      for (const r of (rooms ?? []) as { room_id: string }[]) {
        await removeAll(supabase, "chat-images", await listAll(supabase, "chat-images", r.room_id, 0));
      }

      // 3) 계정과 기록 삭제
      setBusy("탈퇴 처리 중…");
      const { error: err } = await supabase.rpc("withdraw_me");
      if (err) throw new Error(/[가-힣]/.test(err.message) ? err.message : "탈퇴하지 못했어요. 고객센터로 문의해 주세요.");

      await supabase.auth.signOut().catch(() => {});
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "탈퇴하지 못했어요.");
    }
    setBusy("");
  }

  if (done) {
    return (
      <div className={styles.wd}>
        <div className={styles.wdIcon}>👋</div>
        <div className={styles.wdTitle}>탈퇴가 완료되었어요</div>
        <div className={styles.wdDesc}>그동안 리얼해브를 이용해 주셔서 감사합니다.</div>
        {/* 로그인 정보가 남지 않도록 화면을 새로 불러오며 이동 */}
        {/* eslint-disable-next-line @next/next/no-location-assign-relative-destination -- 일부러 전체 새로고침 */}
        <button type="button" className={styles.btn} onClick={() => window.location.assign("/")}>
          홈으로
        </button>
      </div>
    );
  }

  return (
    <div className={styles.wd}>
      <div className={styles.wdIcon}>🚪</div>
      <div className={styles.wdTitle}>정말로 탈퇴하시겠습니까?</div>
      <div className={styles.wdDesc}>
        대화내용, 기존 거래내용은
        <br />
        모두 삭제되며 복구할 수 없습니다.
        <br />
        <small>(신고 처리 중인 대화는 조사를 위해 보관될 수 있어요)</small>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <button type="button" className={`${styles.btn} ${styles.btnDanger}`} disabled={Boolean(busy)} onClick={withdraw}>
        {busy || "예, 탈퇴합니다"}
      </button>
      <Link href="/mypage" className={styles.wdNo}>아니요</Link>
    </div>
  );
}
