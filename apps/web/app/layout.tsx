import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppShell } from "../components/app-shell";
import "./styles.css";

const qingSongShouXieTi = localFont({
  src: "./fonts/QingSongShouXieTi.ttf",
  variable: "--font-community",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Community",
  description: "A moderated community for sharing and events."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN" data-theme="dark" className={qingSongShouXieTi.variable} suppressHydrationWarning><body><AppShell>{children}</AppShell></body></html>;
}
