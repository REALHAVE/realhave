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
      const { data: st } = await supabase.rpc("withdraw_status");
      const row = (Array.isArray(st) ? st[0] : st) as { on_sale: number; open_reports: number } | null;
      if (!row) throw new Error("탈퇴 가능 여부를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
      if (row.on_sale > 0) throw new Error("판매중인 상품이 있어요. 먼저 삭제해주세요.");
      if (row.open_reports > 0)
        throw new Error("처리 중인 신고가 있어 탈퇴할 수 없어요. 신고 처리가 끝난 뒤 다시 시도해주세요.");

      // 2) 사진 정리
      //  - 상품사진: 전자상거래법상 '표시·광고 기록'(6개월) 보관 대상이라 지우지 않음.
      //    상품 글은 화면에서 사라지고, 6개월 뒤 관리자가 법정 보관함에서 파기할 때 함께 삭제
      //  - 정품인증 서류: 보관 대상이 아니므로 바로 삭제
      setBusy("사진 정리 중…");
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
        대화내용, 기존 거래내용(거래완료 상품 포함)은
        <br />
        모두 삭제되며 복구할 수 없습니다.
      </div>
      <p className={styles.hint} style={{ textAlign: "left", marginBottom: 16 }}>
        ※ 단, 전자상거래법(제6조·시행령 제6조)에 따라 아래 기록은 회원님 화면에서는 사라지지만 리얼해브가
        정해진 기간 동안 보관한 뒤 파기해요.
        <br />· 계약·거래 기록: 5년 · 소비자 불만·분쟁 처리 기록: 3년 · 상품 표시·광고 기록: 6개월
      </p>
      {error && <p className={styles.error}>{error}</p>}
      <button type="button" className={`${styles.btn} ${styles.btnDanger}`} disabled={Boolean(busy)} onClick={withdraw}>
        {busy || "예, 탈퇴합니다"}
      </button>
      <Link href="/mypage" className={styles.wdNo}>아니요</Link>
    </div>
  );
}
