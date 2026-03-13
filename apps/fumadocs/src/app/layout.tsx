import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import "./global.css";
import { Inter } from "next/font/google";

const inter = Inter({
	subsets: ["latin"],
});

const DOCS_SITE_URL =
	process.env.NEXT_PUBLIC_DOCS_SITE_URL ?? "https://docs.cyop.design";

export const metadata: Metadata = {
	metadataBase: new URL(DOCS_SITE_URL),
	title: {
		default: "cyop Docs",
		template: "%s | cyop Docs",
	},
	description: "cyop 的文档站与共享设计系统说明。",
};

export default function Layout({ children }: LayoutProps<"/">) {
	return (
		<html lang="en" className={inter.className} suppressHydrationWarning>
			<body className="flex min-h-screen flex-col">
				<RootProvider>{children}</RootProvider>
			</body>
		</html>
	);
}
