import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import SubTopBar from "@/components/SubTopBar";
import { getSessionUser } from "@/lib/auth/session";
import { productImageUrl } from "@/lib/catalog-url";
import { getMyRoomReport, getRoom } from "@/lib/chat";
import { formatPrice } from "@/lib/format";
import ChatRoom from "./ChatRoom";
import styles from "../chat.module.css";

export const metadata = { title: "채팅 · Real HAVE" };

async function Content({ params }: { params: PageProps<"/chat/[roomId]">["params"] }) {
  const [{ roomId }, user] = await Promise.all([params, getSessionUser()]);
  if (!user) redirect(`/login?next=/chat/${roomId}`);

  const room = await getRoom(roomId, user.id);
  if (!room) notFound();
  // 내가 이 대화를 신고했다면 (신고자 본인에게만 보임)
  const myReport = await getMyRoomReport(room.id, user.id);

  return (
    <>
      <div className={styles.roomHead}>
        <div style={{ position: "relative" }}>
          <SubTopBar title={room.otherNickname} fallback="/chat" />
          <Link href={`/report?room=${room.id}`} className={styles.reportLink}>신고</Link>
        </div>
        {room.product && (
          <Link href={`/products/${room.productId}`} className={styles.productBar}>
            <div className={styles.avatar}>
              {room.product.thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={productImageUrl(room.product.thumb)} alt="" />
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className={styles.pName}>
                {room.product.status === "sold" && "[거래완료] "}
                {room.product.brand} {room.product.title}
              </div>
              <div className={styles.pPrice}>{formatPrice(room.product.price)}</div>
            </div>
          </Link>
        )}
        {myReport && (
          <div className={`${styles.reportNotice} ${myReport.status === "open" ? "" : styles.reportDone}`}>
            {myReport.status === "open" ? (
              <>🚨 <b>신고 접수됨</b> — 리얼해브 관리자가 확인하고 있어요. 결과는 여기에 알려드릴게요.</>
            ) : (
              <>
                ✅ <b>신고 처리 결과: {myReport.status === "resolved" ? "조치 완료" : "문제 없음으로 확인"}</b>
                {myReport.result_message && <span className={styles.reportMsg}>{myReport.result_message}</span>}
              </>
            )}
            <small>이 안내는 나에게만 보여요.</small>
          </div>
        )}
        <p className={styles.guide}>
          🔒 직거래 안전 가이드 — 거래 전 정품 인증 서류(한글표기 택·인보이스)를 반드시 채팅으로
          확인하세요. 선입금 요구는 주의하세요.
        </p>
      </div>

      <ChatRoom roomId={room.id} myId={user.id} initial={room.messages} />
    </>
  );
}

export default function ChatRoomPage(props: PageProps<"/chat/[roomId]">) {
  return (
    <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
      <Content params={props.params} />
    </Suspense>
  );
}
