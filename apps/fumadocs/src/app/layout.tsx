import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./global.css";

const inter = Inter({
	subsets: ["latin"],
});

const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL ?? "http://localhost:4000";

export const metadata: Metadata = {
	title: {
		default: "cyop Docs",
		template: "%s | cyop Docs",
	},
	description: "cyop 项目文档、架构说明与开发接入指南。",
	metadataBase: new URL(docsUrl),
};

export default function Layout({ children }: LayoutProps<"/">) {
	return (
		<html lang="zh-CN" className={inter.className} suppressHydrationWarning>
			<body className="flex min-h-screen flex-col">
				<RootProvider>{children}</RootProvider>
			</body>
		</html>
	);
}
