"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// 내 채팅방에 변화(새 메시지 등)가 생기면 화면을 다시 불러옴.
// 남의 채팅방 변화는 DB 권한(RLS) 때문에 애초에 전달되지 않음.
// 실시간 연결이 잠깐 끊겼던 경우(연결 직후·화면을 다시 켰을 때)에도 다시 불러옴
export default function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300); // 여러 개가 한꺼번에 와도 한 번만
    };

    supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel("my-chat-rooms")
        .on("postgres_changes", { event: "*", schema: "public", table: "chat_rooms" }, refresh)
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") refresh();
        });
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
