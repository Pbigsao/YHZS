import type { Metadata } from "next";
import localFont from "next/font/local";
import "./styles.css";

const qingSongShouXieTi = localFont({
  src: "./fonts/QingSongShouXieTi.ttf",
  variable: "--font-qing-song",
  display: "swap"
});

export const metadata: Metadata = {
  title: "YH Community",
  description: "A moderated community for sharing and events."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" className={qingSongShouXieTi.variable}><body>{children}</body></html>;
}
