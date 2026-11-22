"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/chat";
import { dateLabel, timeOfDay } from "@/lib/format";
import { prepareImage, randomId } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import styles from "../chat.module.css";

const KST_DAY = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);

export default function ChatRoom({
  roomId,
  myId,
  initial,
}: {
  roomId: string;
  myId: string;
  initial: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const firstScroll = useRef(true);

  // 메시지 합치기: 같은 메시지는 한 번만, 보낸 시각 순서대로
  function merge(incoming: ChatMessage[]) {
    if (incoming.length === 0) return;
    setMessages((list) => {
      const byId = new Map(list.map((m) => [m.id, m]));
      let changed = false;
      for (const m of incoming) {
        const old = byId.get(m.id);
        if (!old || (!old.image_url && m.image_url)) {
          byId.set(m.id, { ...old, ...m });
          changed = true;
        }
      }
      if (!changed) return list;
      return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }
  function add(m: ChatMessage) {
    merge([m]);
  }

  // 실시간 수신 + 빠진 메시지 다시 확인 + 읽음 처리
  //  실시간 연결은 연결 직후·화면이 꺼졌다 켜질 때 잠깐 끊길 수 있어서,
  //  그때마다(그리고 몇 초마다) 최근 메시지를 다시 불러와 빠진 것을 채움
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;

    const markRead = () => {
      supabase.rpc("mark_room_read", { p_room_id: roomId }).then(() => {});
    };

    async function withImageUrls(list: ChatMessage[]): Promise<ChatMessage[]> {
      const paths = list.filter((m) => m.image_path && !m.image_url).map((m) => m.image_path as string);
      if (paths.length === 0) return list;
      const { data } = await supabase.storage.from("chat-images").createSignedUrls(paths, 3600);
      const urls = new Map<string, string>(
        ((data ?? []) as { path: string | null; signedUrl: string }[]).map((s) => [s.path ?? "", s.signedUrl]),
      );
      return list.map((m) =>
        m.image_path && !m.image_url ? { ...m, image_url: urls.get(m.image_path) ?? null } : m,
      );
    }

    async function catchUp() {
      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, body, image_path, created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled || !data) return;
      merge(await withImageUrls(data as ChatMessage[]));
      if ((data as ChatMessage[]).some((m) => m.sender_id !== myId)) markRead();
    }

    markRead();
    supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`room:${roomId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
          async (payload: { new: Record<string, unknown> }) => {
            const [m] = await withImageUrls([payload.new as unknown as ChatMessage]);
            merge([m]);
            if (m.sender_id !== myId) markRead();
          },
        )
        .subscribe((status: string) => {
          // 연결(재연결)될 때마다 그 사이 빠진 메시지 확인
          if (status === "SUBSCRIBED") catchUp();
        });
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") catchUp();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", catchUp);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") catchUp();
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", catchUp);
      if (channel) supabase.removeChannel(channel);
    };
  }, [roomId, myId]);

  // 새 메시지가 생기면 맨 아래로
  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: firstScroll.current ? "auto" : "smooth" });
    firstScroll.current = false;
  }, [messages.length]);

  async function sendText() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    const { data, error: err } = await createClient()
      .from("messages")
      .insert({ room_id: roomId, sender_id: myId, body })
      .select("id, sender_id, body, image_path, created_at")
      .single();
    setSending(false);
    if (err || !data) {
      setError(friendly(err?.message));
      return;
    }
    setText("");
    add(data as ChatMessage);
  }

  async function sendPhoto(file: File) {
    setSending(true);
    setError("");
    const supabase = createClient();
    try {
      const img = await prepareImage(file);
      const path = `${roomId}/${randomId()}.${img.ext}`;
      const { error: upErr } = await supabase.storage
        .from("chat-images")
        .upload(path, img.blob, { contentType: img.type, upsert: false });
      if (upErr) throw new Error("사진을 보내지 못했어요.");
      const { data, error: err } = await supabase
        .from("messages")
        .insert({ room_id: roomId, sender_id: myId, image_path: path })
        .select("id, sender_id, body, image_path, created_at")
        .single();
      if (err || !data) {
        await supabase.storage.from("chat-images").remove([path]);
        throw new Error(friendly(err?.message));
      }
      const { data: signed } = await supabase.storage.from("chat-images").createSignedUrl(path, 3600);
      add({ ...(data as ChatMessage), image_url: signed?.signedUrl ?? null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진을 보내지 못했어요.");
    }
    setSending(false);
  }

  return (
    <>
      <div className={styles.messages}>
        {messages.length === 0 && (
          <p className={styles.empty} style={{ padding: "30px 0" }}>
            첫 메시지를 보내보세요. 정품 인증 서류 확인을 먼저 요청하는 것을 추천해요.
          </p>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === myId;
          const newDay = i === 0 || KST_DAY(messages[i - 1].created_at) !== KST_DAY(m.created_at);
          return (
            <div key={m.id} style={{ display: "contents" }}>
              {newDay && <div className={styles.day}>{dateLabel(m.created_at)}</div>}
              <div className={`${styles.line} ${mine ? styles.mine : ""}`}>
                {m.image_path ? (
                  <a className={styles.photo} href={m.image_url ?? undefined} target="_blank" rel="noreferrer">
                    {m.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.image_url} alt="보낸 사진" />
                    ) : (
                      <span style={{ padding: 20, display: "block", fontSize: 12 }}>사진</span>
                    )}
                  </a>
                ) : (
                  <div className={styles.bubble}>{m.body}</div>
                )}
                <span className={styles.stamp}>{timeOfDay(m.created_at)}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className={styles.sendError}>{error}</p>}

      <form
        className={styles.composer}
        onSubmit={(e) => {
          e.preventDefault();
          sendText();
        }}
      >
        <label className={styles.attach} aria-label="사진 보내기">
          <input type="file" accept="image/*" hidden disabled={sending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) sendPhoto(f);
            }} />
          +
        </label>
        <textarea
          className={styles.input}
          rows={1}
          value={text}
          maxLength={1000}
          placeholder="메시지를 입력하세요"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // PC: Enter 전송, Shift+Enter 줄바꿈 (한글 입력 중에는 전송 안 함)
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              sendText();
            }
          }}
        />
        <button className={styles.send} disabled={sending || !text.trim()}>
          전송
        </button>
      </form>
    </>
  );
}

function friendly(message?: string) {
  if (message && /row-level security|violates/i.test(message))
    return "메시지를 보낼 수 없어요. (이용이 제한된 계정이거나 대화 상대가 아니에요)";
  return message && /[가-힣]/.test(message) ? message : "메시지를 보내지 못했어요. 다시 시도해 주세요.";
}
