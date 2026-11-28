import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/validation";
import AuthTopBar from "../../AuthTopBar";
import CompleteForm from "./CompleteForm";
import styles from "../../auth.module.css";

export const metadata = { title: "추가 정보 입력 · Real HAVE" };

// 소셜로 처음 가입한 회원: 닉네임·휴대폰번호·약관 동의
async function Content({ searchParams }: { searchParams: PageProps<"/signup/complete">["searchParams"] }) {
  const [user, sp] = await Promise.all([getSessionUser(), searchParams]);
  const next = safeNext(sp.next, "/mypage");
  if (!user) redirect("/login");
  if (!user.needsOnboarding) redirect(next);
  return <CompleteForm nickname={user.nickname} next={next} />;
}

export default function SignupCompletePage(props: PageProps<"/signup/complete">) {
  return (
    <>
      <AuthTopBar title="추가 정보 입력" back="/mypage" />
      <Suspense fallback={<p className={styles.hint} style={{ padding: 20 }}>불러오는 중…</p>}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
