import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { HandoffGuard } from "@/components/HandoffGuard";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pass & Play Poker",
  description: "1台のスマホを手渡しして遊ぶオフラインのテキサスホールデム",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "P&P Poker",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  // ノッチ端末のセーフエリアまで描画する(standalone表示でのアクションボタン干渉はPhase 9実機確認項目)
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh min-w-[375px] flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <HandoffGuard />
        {children}
      </body>
    </html>
  );
}
