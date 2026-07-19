import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "YH Community",
  description: "A moderated community for sharing and events."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
