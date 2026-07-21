import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "YH Community - 动漫社团交流社区",
  description: "一个属于大学动漫社团的交流社区。分享作品、参与活动、讨论你热爱的一切。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
        {/* MiSans font from CDN */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/misans@latest/lib/Normal/MiSans-Regular.min.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/misans@latest/lib/Normal/MiSans-Medium.min.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/misans@latest/lib/Normal/MiSans-Bold.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
