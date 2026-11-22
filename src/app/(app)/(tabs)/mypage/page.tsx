import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/(app)/(auth)/actions";
import { getSessionUser } from "@/lib/auth/session";
import { listMyProducts } from "@/lib/catalog";
import { countPurchases, countWishlist, getMyRooms } from "@/lib/chat";
import tabs from "../tabs.module.css";
import styles from "./mypage.module.css";

export const metadata = { title: "마이페이지 · Real HAVE" };

// 아직 연결 안 된 메뉴 (각 단계에서 연결)
const MENU_COMMON = ["공지사항", "고객센터", "약관 및 정책", "앱설정"];

function Menu({ items }: { items: string[] }) {
  return (
    <ul className={styles.menu}>
      {items.map((label) => (
        <li key={label} className={styles.item}>
          <span>{label}</span>
          <span className={styles.chev}>›</span>
        </li>
      ))}
    </ul>
  );
}

function GuestView() {
  return (
    <>
      <div className={styles.guestCard}>
        <p className={styles.guestTitle}>로그인이 필요해요</p>
        <p className={styles.guestSub}>로그인하고 정품인증 거래를 시작해보세요</p>
        <Link href="/login?next=/mypage" className={styles.btnFull}>
          로그인
        </Link>
        <p className={styles.guestSignup}>
          아직 회원이 아니신가요? <Link href="/signup">회원가입</Link>
        </p>
      </div>
      <Menu items={MENU_COMMON} />
    </>
  );
}

async function MyPageContent() {
  const user = await getSessionUser();
  if (!user) return <GuestView />;

  const [myProducts, wishCount, rooms, purchaseCount] = await Promise.all([
    listMyProducts(user.id),
    countWishlist(user.id),
    getMyRooms(),
    countPurchases(user.id),
  ]);
  const unread = rooms.reduce((sum, r) => sum + r.unread, 0);
  const stats = [
    { label: "구매내역", num: purchaseCount, href: "/purchases" },
    { label: "판매내역", num: myProducts.length, href: "/sales" },
    { label: "찜", num: wishCount, href: "/wishlist" },
    { label: unread > 0 ? `채팅 (새 ${unread})` : "채팅", num: rooms.length, href: "/chat" },
  ];

  return (
    <>
      <div className={styles.header}>
        <div className={styles.avatar} />
        <div>
          <p className={styles.name}>{user.nickname}</p>
          <p className={styles.grade}>
            {user.status === "suspended" ? "이용이 제한된 계정입니다" : "인증회원"}
          </p>
        </div>
      </div>

      <div className={styles.stats}>
        {stats.map((s) => {
          const inner = (
            <>
              <div className={styles.num}>{s.num}</div>
              <div className={styles.lbl}>{s.label}</div>
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className={styles.cell}>
              {inner}
            </Link>
          ) : (
            <div key={s.label} className={styles.cell}>
              {inner}
            </div>
          );
        })}
      </div>

      <Menu items={["내정보수정", ...MENU_COMMON, "탈퇴하기"]} />

      <form action={logout}>
        <button className={styles.logout}>로그아웃</button>
      </form>
    </>
  );
}

export default function MyPage() {
  return (
    <>
      <header className={tabs.topbar}>
        <h1 className={tabs.title}>마이페이지</h1>
      </header>
      <Suspense fallback={<div className={styles.loading}>불러오는 중…</div>}>
        <MyPageContent />
      </Suspense>
    </>
  );
}
