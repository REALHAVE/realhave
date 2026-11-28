"use client";

import { useState } from "react";
import { SOCIAL_PROVIDERS, type SocialProvider } from "@/lib/auth/social";
import { createClient } from "@/lib/supabase/client";
import styles from "../auth.module.css";

// 카카오·Apple·Google 로그인. 누르면 각 회사 로그인 화면으로 갔다가 /auth/callback 으로 돌아옴
export default function SocialButtons({ next }: { next: string }) {
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState("");

  async function start(provider: SocialProvider) {
    setBusy(provider);
    setError("");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: err } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (err) {
      setBusy(null);
      setError("지금은 이 방법으로 로그인할 수 없어요. 이메일로 로그인해 주세요.");
    }
    // 성공하면 브라우저가 해당 회사 로그인 화면으로 이동함
  }

  return (
    <div className={styles.social}>
      {error && <p className={styles.error}>{error}</p>}
      {SOCIAL_PROVIDERS.map((p) =>
        p.enabled ? (
          <button key={p.id} type="button" className={`${styles.soc} ${styles[`soc_${p.id}`]}`}
            disabled={busy !== null} onClick={() => start(p.id)}>
            {busy === p.id ? "이동 중…" : p.label}
          </button>
        ) : (
          <div key={p.id} className={styles.soc}>{p.label} (준비 중)</div>
        ),
      )}
    </div>
  );
}
