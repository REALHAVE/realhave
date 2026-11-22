import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import SubTopBar from "@/components/SubTopBar";
import { getSessionUser } from "@/lib/auth/session";
import { productImageUrl } from "@/lib/catalog-url";
import { getMyRooms } from "@/lib/chat";
import { chatTimeLabel } from "@/lib/format";
import LiveRefresh from "./LiveRefresh";
import styles from "./chat.module.css";

export const metadata = { title: "채팅 · Real HAVE" };

async function Content() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/chat");
  const rooms = await getMyRooms();

  return (
    <>
      {/* 새 메시지가 오면 목록을 자동으로 새로고침 */}
      <LiveRefresh />
      {rooms.length === 0 ? (
        <p className={styles.empty}>
          아직 채팅이 없어요.
          <br />
          상품 화면에서 <b>메시지</b>를 눌러 판매자와 대화해 보세요.
        </p>
      ) : (
        <ul className={styles.list}>
          {rooms.map((r) => (
            <li key={r.room_id}>
              <Link href={`/chat/${r.room_id}`} className={styles.row}>
                <div className={styles.avatar}>
                  {r.thumb_path && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={productImageUrl(r.thumb_path)} alt="" />
                  )}
                </div>
                <div className={styles.rowInfo}>
                  <div className={styles.top}>
                    <span className={styles.name}>
                      {r.other_nickname}
                      <small>{r.i_am_seller ? " · 구매희망" : " · 판매자"}</small>
                    </span>
                    <span className={styles.time}>{chatTimeLabel(r.last_message_at)}</span>
                  </div>
                  <div className={styles.product}>
                    {r.product_status === "sold" && <b>[거래완료] </b>}
                    {r.brand_name} {r.product_title}
                  </div>
                  <div className={styles.msg}>{r.last_message ?? "대화를 시작해 보세요."}</div>
                </div>
                {r.unread > 0 && <span className={styles.badge}>{r.unread > 99 ? "99+" : r.unread}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function ChatListPage() {
  return (
    <>
      <SubTopBar title="채팅" fallback="/mypage" />
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content />
      </Suspense>
    </>
  );
}
