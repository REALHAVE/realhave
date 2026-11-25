"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SupportMessage } from "@/lib/chat";
import { createClient } from "@/lib/supabase/client";
import styles from "./SupportChat.module.css";

const timeOf = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

// 관리자 ↔ 회원 1:1 대화. viewer 가 "admin"이면 관리자 화면, "user"면 회원 화면
// 실시간 수신 + 연결이 끊긴 사이 빠진 메시지는 다시 불러와 채움
export default function SupportChat({
  threadId,
  myId,
  viewer,
  otherName,
  initial,
}: {
  threadId: string;
  myId: string;
  viewer: "admin" | "user";
  otherName: string;
  initial: SupportMessage[];
}) {
  const [messages, setMessages] = useState<SupportMessage[]>(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  function merge(list: SupportMessage[]) {
    if (list.length === 0) return;
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      let changed = false;
      for (const m of list) {
        if (!byId.has(m.id)) {
          byId.set(m.id, m);
          changed = true;
        }
      }
      return changed ? [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at)) : prev;
    });
  }

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    const markRead = () => {
      supabase.rpc("mark_thread_read", { p_thread_id: threadId }).then(() => {});
    };
    async function catchUp() {
      const { data } = await supabase
        .from("support_messages")
        .select("id, sender_id, is_admin, body, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled || !data) return;
      merge(data as SupportMessage[]);
      markRead();
    }

    markRead();
    supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`support:${threadId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "support_messages", filter: `thread_id=eq.${threadId}` },
          (payload: { new: Record<string, unknown> }) => {
            merge([payload.new as unknown as SupportMessage]);
            markRead();
          },
        )
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") catchUp();
        });
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") catchUp();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") catchUp();
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [threadId]);

  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    const { data, error: err } = await createClient()
      .from("support_messages")
      .insert({ thread_id: threadId, sender_id: myId, body })
      .select("id, sender_id, is_admin, body, created_at")
      .single();
    setSending(false);
    if (err || !data) {
      setError("메시지를 보내지 못했어요. 다시 시도해 주세요.");
      return;
    }
    setText("");
    merge([data as SupportMessage]);
  }

  return (
    <div className={`${styles.wrap} ${viewer === "admin" ? styles.adminWrap : ""}`}>
      <div className={styles.messages}>
        {messages.length === 0 && (
          <p className={styles.empty}>
            {viewer === "admin"
              ? `${otherName}님에게 보낼 첫 메시지를 입력하세요. 신고자는 이 대화를 볼 수 없어요.`
              : "리얼해브 관리자와의 대화예요."}
          </p>
        )}
        {messages.map((m) => {
          // 관리자 화면: 관리자 메시지가 오른쪽 / 회원 화면: 회원 메시지가 오른쪽
          const right = viewer === "admin" ? m.is_admin : !m.is_admin;
          const who = m.is_admin ? "리얼해브 관리자" : otherName;
          return (
            <div key={m.id} className={`${styles.line} ${right ? styles.right : ""}`}>
              {!right && <span className={styles.who}>{who}</span>}
              <div className={`${styles.bubble} ${m.is_admin ? styles.adminBubble : ""}`}>{m.body}</div>
              <span className={styles.time}>{timeOf(m.created_at)}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className={styles.error}>{error}</p>}
      <form
        className={styles.composer}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          className={styles.input}
          rows={1}
          value={text}
          maxLength={2000}
          placeholder={viewer === "admin" ? `${otherName}님에게 메시지` : "관리자에게 답장하기"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className={styles.send} disabled={sending || !text.trim()}>전송</button>
      </form>
    </div>
  );
}
