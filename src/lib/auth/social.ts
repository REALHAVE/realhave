// 소셜 로그인 버튼 설정.
// 각 회사(카카오·Apple·Google) 개발자 사이트와 Supabase 설정을 마친 것만 enabled: true 로 켬
export type SocialProvider = "kakao" | "apple" | "google";

export const SOCIAL_PROVIDERS: { id: SocialProvider; label: string; enabled: boolean }[] = [
  { id: "kakao", label: "카카오로 시작하기", enabled: false },
  { id: "apple", label: "Apple로 시작하기", enabled: false },
  { id: "google", label: "Google로 시작하기", enabled: false },
];
