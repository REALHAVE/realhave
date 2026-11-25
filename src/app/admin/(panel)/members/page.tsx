import { Suspense } from "react";
import { ROLE_NAME } from "@/lib/auth/admin";
import { listMembers, timeAgo } from "@/lib/admin-data";
import { NoPermission, requireAdmin } from "../Guard";
import DeleteMember from "./DeleteMember";
import MemberActions from "./MemberActions";
import styles from "../../admin.module.css";

export const metadata = { title: "회원 관리 · 관리자" };

const ymd = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }).replace(/\s/g, "").replace(/\.$/, "");

const phoneFmt = (p: string | null) =>
  p ? p.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3") : "-";

async function Content({ searchParams }: { searchParams: PageProps<"/admin/members">["searchParams"] }) {
  const [admin, sp] = await Promise.all([requireAdmin("cs"), searchParams]);
  if (!admin) return <NoPermission />;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 50) : "";
  const members = await listMembers(q);
  const isMaster = admin.role === "master";

  return (
    <>
      <form className={styles.formRow} role="search">
        <input className={`${styles.field} ${styles.fieldWide}`} name="q" defaultValue={q}
          placeholder="닉네임, 이메일, 휴대폰번호(4자리 이상)로 검색" />
        <button className={`${styles.btn} ${styles.primary}`}>검색</button>
      </form>

      <div className={styles.panel}>
        <h2>회원 {members.length}명{q && ` (검색: ${q})`}</h2>
        {members.length === 0 ? (
          <p className={styles.empty}>회원이 없어요.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>닉네임</th><th>이메일 · 휴대폰</th><th>가입일</th><th>최근 로그인</th>
                <th>구매</th><th>판매중 · 완료</th><th>상태</th>{isMaster && <th>관리</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <b>{m.nickname}</b>
                    {m.admin_role && (
                      <div><span className={`${styles.badge} ${styles.muted}`}>{ROLE_NAME[m.admin_role]}</span></div>
                    )}
                  </td>
                  <td>
                    {m.email}
                    {!m.email_confirmed && <span className={styles.inlineErr}> (메일 미인증)</span>}
                    <div style={{ color: "var(--ink-soft)" }}>{phoneFmt(m.phone)}</div>
                  </td>
                  <td>{ymd(m.created_at)}</td>
                  <td>{m.last_sign_in_at ? timeAgo(m.last_sign_in_at) : "-"}</td>
                  <td>{m.purchase_count}건</td>
                  <td>{m.on_sale_count}건 · {m.sold_count}건</td>
                  <td>
                    {m.status === "active" ? (
                      <span className={`${styles.badge} ${styles.ok}`}>정상</span>
                    ) : (
                      <>
                        <span className={`${styles.badge} ${styles.bad}`}>자격중지</span>
                        {m.suspended_reason && (
                          <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4 }}>
                            사유: {m.suspended_reason}
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  {isMaster && (
                    <td>
                      {m.id === admin.id ? (
                        <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>본인</span>
                      ) : (
                        <>
                          <MemberActions key={m.id + m.status /* 상태가 바뀌면 새로 그림 */} userId={m.id} nickname={m.nickname} suspended={m.status === "suspended"} />{" "}
                          <DeleteMember userId={m.id} nickname={m.nickname} />
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className={styles.note}>
          ※ 자격중지된 회원은 로그인은 되지만 상품 등록·채팅·찜·신고를 할 수 없고, 판매 상품은 홈에서
          숨겨져요. 회원삭제는 되돌릴 수 없어요 (신고 처리 중인 대화만 증거로 보관).
          {!isMaster && " 자격중지·허용은 전체 관리자만 할 수 있어요."}
        </p>
      </div>
    </>
  );
}

export default function MembersPage(props: PageProps<"/admin/members">) {
  return (
    <>
      <div className={styles.topbar}>
        <h1>회원 관리</h1>
      </div>
      <Suspense fallback={<p className={styles.empty}>불러오는 중…</p>}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
