import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@cyop/ui";
import Link from "next/link";

export default function HomePage() {
	return (
		<div className="flex flex-1 items-center justify-center px-6 py-10">
			<Card className="max-w-2xl border-dashed bg-card/80 text-left">
				<CardHeader className="space-y-4">
					<Badge variant="outline" className="w-fit">
						cyop.design
					</Badge>
					<CardTitle className="text-3xl">
						统一的 shadcn UI 设计系统，Web 与文档共用一套组件
					</CardTitle>
					<CardDescription>
						所有按钮、卡片、表单与主题变量都来自 <code>@cyop/ui</code> 包，
						你可以在「控制塔」和这个文档站之间获得完全一致的体验。
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="rounded-lg border bg-background/80 p-4">
							<p className="font-semibold text-muted-foreground text-sm">
								实时同步
							</p>
							<p className="text-sm">
								Web、Docs、以及未来的产品都从同一个 shadcn 衍生层获取组件。
							</p>
						</div>
						<div className="rounded-lg border bg-background/80 p-4">
							<p className="font-semibold text-muted-foreground text-sm">
								暗色模式支持
							</p>
							<p className="text-sm">
								主题变量定义在 <code>@cyop/ui/styles.css</code>{" "}
								中，一处修改全局生效。
							</p>
						</div>
					</div>
					<div className="flex flex-wrap gap-3">
						<Button asChild>
							<Link href="/docs">浏览文档</Link>
						</Button>
						<Button variant="outline" asChild>
							<Link href="http://localhost:3001">返回控制塔</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
