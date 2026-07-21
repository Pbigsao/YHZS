import type { Metadata } from "next";
import localFont from "next/font/local";
import "./styles.css";

const qingSongShouXieTi = localFont({
  src: "./fonts/QingSongShouXieTi.ttf",
  variable: "--font-community",
  display: "swap"
});

export const metadata: Metadata = {
  title: "YH Community - 动漫社团交流社区",
  description: "一个属于大学动漫社团的交流社区。分享作品、参与活动、讨论你热爱的一切。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-theme="dark" className={qingSongShouXieTi.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
