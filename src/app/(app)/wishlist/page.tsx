import SubTopBar from "@/components/SubTopBar";
import Placeholder from "@/components/Placeholder";

export const metadata = { title: "찜 목록 · Real HAVE" };

// 로그인한 회원만 (proxy.ts). 실제 화면은 8단계
export default function Page() {
  return (
    <>
      <SubTopBar title="찜 목록" />
      <Placeholder title="찜 목록" step="8단계(찜·채팅)" />
    </>
  );
}
