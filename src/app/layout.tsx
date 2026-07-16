import type { Metadata } from "next";
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
      <body className="min-h-full min-w-[375px] flex flex-col">
        <HandoffGuard />
        {children}
      </body>
    </html>
  );
}
