import SubTopBar from "@/components/SubTopBar";
import Placeholder from "@/components/Placeholder";

export const metadata = { title: "채팅 · Real HAVE" };

// 로그인한 회원만 (proxy.ts). 실제 화면은 8단계
export default function Page() {
  return (
    <>
      <SubTopBar title="채팅" />
      <Placeholder title="채팅" step="8단계(찜·채팅)" />
    </>
  );
}
