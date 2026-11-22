// 회원용 화면: 휴대폰에서는 화면 전체, PC에서는 가운데 휴대폰 폭
// (관리자 화면 /admin 은 이 틀 밖에서 PC 폭으로 표시)
export default function AppFrameLayout({ children }: { children: React.ReactNode }) {
  return <div className="app-frame">{children}</div>;
}
