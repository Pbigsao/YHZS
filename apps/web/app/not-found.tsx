import Link from "next/link";

export default function NotFound() {
  return <section className="contentPage"><h1 className="pageTitle">页面不存在</h1><p className="pageLead">这个地址没有可显示的内容。</p><Link className="primaryButton" href="/">返回话题</Link></section>;
}
