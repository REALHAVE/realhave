import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/(app)/(auth)/actions";
import { getSessionUser } from "@/lib/auth/session";
import { listMyProducts } from "@/lib/catalog";
import { countPurchases, countWishlist, getMyRooms, getMySupportThreads } from "@/lib/chat";
import tabs from "../tabs.module.css";
import styles from "./mypage.module.css";

export const metadata = { title: "마이페이지 · Real HAVE" };

type MenuItem = { label: string; href?: string; note?: string };

// href 가 없는 메뉴는 아직 준비 중 (약관은 13단계, 내정보수정·앱설정은 추후)
const MENU_COMMON: MenuItem[] = [
  { label: "공지사항", href: "/notices" },
  { label: "고객센터 · 1:1 문의", href: "/support" },
  { label: "약관 및 정책", note: "준비 중" },
];

function Menu({ items }: { items: MenuItem[] }) {
  return (
    <ul className={styles.menu}>
      {items.map((m) => (
        <li key={m.label}>
          {m.href ? (
            <Link href={m.href} className={styles.item}>
              <span>{m.label}</span>
              <span className={styles.chev}>›</span>
            </Link>
          ) : (
            <div className={styles.item} style={{ color: "var(--ink-soft)" }}>
              <span>{m.label}</span>
              <span className={styles.chev}>{m.note}</span>
            </div>
          )}
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

  const [myProducts, wishCount, rooms, purchaseCount, threads] = await Promise.all([
    listMyProducts(user.id),
    countWishlist(user.id),
    getMyRooms(),
    countPurchases(user.id),
    getMySupportThreads(),
  ]);
  // 안 읽은 수 = 거래 채팅 + 관리자 대화
  const unread =
    rooms.reduce((sum, r) => sum + r.unread, 0) + threads.reduce((sum, t) => sum + t.unread, 0);
  // 판매내역 = 지금 판매중인 상품(심사대기·반려 포함), 판매완료 = 거래완료된 상품
  const onSaleCount = myProducts.filter((p) => p.status === "on_sale").length;
  const soldCount = myProducts.filter((p) => p.status === "sold").length;
  const stats = [
    { label: "구매내역", num: purchaseCount, href: "/purchases", badge: 0 },
    { label: "판매내역", num: onSaleCount, href: "/sales", badge: 0 },
    { label: "판매완료", num: soldCount, href: "/sales?tab=done", badge: 0 },
    { label: "찜", num: wishCount, href: "/wishlist", badge: 0 },
    { label: "채팅", num: rooms.length, href: "/chat", badge: unread },
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
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className={styles.cell}>
            <div className={styles.num}>{s.num}</div>
            <div className={styles.lbl}>{s.label}</div>
            {s.badge > 0 && (
              <span className={styles.newBadge} aria-label={`안 읽은 메시지 ${s.badge}개`}>
                {s.badge > 99 ? "99+" : s.badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      <Menu items={[...MENU_COMMON, { label: "탈퇴하기", href: "/withdraw" }]} />

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
