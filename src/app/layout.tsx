import type { Metadata, Viewport } from "next";
import { Fraunces, Noto_Sans_KR, Playfair_Display } from "next/font/google";
import "./globals.css";

// 목업과 같은 폰트 3종 (Google Fonts를 우리 서버에서 직접 제공)
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  preload: false, // 한글 글꼴은 용량이 커서 미리 받지 않고 필요한 글자만 받음
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600", "700", "900"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Real HAVE · 리얼해브",
  description: "정품인증 중고명품 개인간 거래",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4D1437",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} ${fraunces.variable} ${playfair.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
