"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// 내 채팅방에 변화(새 메시지 등)가 생기면 화면을 다시 불러옴.
// 남의 채팅방 변화는 DB 권한(RLS) 때문에 애초에 전달되지 않음
export default function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300); // 여러 개가 한꺼번에 와도 한 번만
    };

    let channel: ReturnType<typeof supabase.channel> | undefined;
    supabase.realtime.setAuth().then(() => {
      channel = supabase
        .channel("my-chat-rooms")
        .on("postgres_changes", { event: "*", schema: "public", table: "chat_rooms" }, refresh)
        .subscribe();
    });

    return () => {
      clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
