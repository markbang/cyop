import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Layers, ShieldCheck, Sparkles, Users2 } from "lucide-react";

import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/")({
	component: LandingPage,
});

const features = [
	{
		title: "统一需求与数据集模型",
		description: "从业务目标到素材分发在一个界面串联，减少跨系统沟通成本。",
		icon: <Layers className="size-4" />,
	},
	{
		title: "AI Caption / 标签联动",
		description: "AI 自动描述 + 人工复核闭环，覆盖率与异常实时可见。",
		icon: <Sparkles className="size-4" />,
	},
	{
		title: "批量任务调度",
		description: "Caption、Tagging、QA、分发任务排队运行，自动记录进展。",
		icon: <ShieldCheck className="size-4" />,
	},
	{
		title: "灵活的协作权限",
		description: "面向供应商、审核及运营的统一看板，配套 Better-Auth 管理。",
		icon: <Users2 className="size-4" />,
	},
];

function LandingPage() {
	const stats = useQuery(trpc.requirement.stats.queryOptions());
	const health = useQuery(trpc.healthCheck.queryOptions());
	const apiHealthy = health.data === "OK";

	return (
		<div className="min-h-full bg-muted/10">
			<div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
				<section className="grid items-center gap-10 lg:grid-cols-[3fr_2fr]">
					<div className="space-y-6">
						<Badge variant="outline">cyop / creative ops</Badge>
						<div className="space-y-4">
							<h1 className="text-4xl font-semibold leading-tight">
								面向 AI 时代的图像资产管理与自动化协作平台
							</h1>
							<p className="text-base text-muted-foreground">
								从需求发起、图片采集、AI caption 打标到批量质检与分发，全部流程沉淀在一个一致的 UI。
								通过实时指标、看板与任务调度，帮助团队快速构建可复用的数据资产。
							</p>
						</div>
						<div className="flex flex-wrap gap-3">
							<Button asChild>
								<Link to="/dashboard">
									进入控制塔
									<ArrowRight className="ml-2 size-4" />
								</Link>
							</Button>
							<Button variant="outline" asChild>
								<Link to="/login">邀请协作者</Link>
							</Button>
						</div>
					</div>
					<Card className="bg-card/80 shadow-lg">
						<CardHeader>
							<CardTitle>实时运行脉搏</CardTitle>
							<CardDescription>核心指标直接读取服务器状态，用于首页提醒。</CardDescription>
						</CardHeader>
						<CardContent className="space-y-5">
							<div>
								<p className="text-sm text-muted-foreground">AI Caption 覆盖率</p>
								<p className="text-3xl font-semibold">
									{stats.data ? `${stats.data.coverage.aiCaption}%` : "--"}
								</p>
								<Progress value={stats.data?.coverage.aiCaption ?? 0} className="mt-2" />
							</div>
							<div>
								<p className="text-sm text-muted-foreground">任务成功率</p>
								<p className="text-3xl font-semibold">
									{stats.data ? `${stats.data.automation.successRate}%` : "--"}
								</p>
								<Progress value={stats.data?.automation.successRate ?? 0} className="mt-2" />
							</div>
							<div className="flex items-center justify-between rounded-xl border bg-muted/40 p-3">
								<div>
									<p className="text-xs text-muted-foreground">API 状态</p>
									<p className="font-medium">
										{health.isLoading ? "检查中..." : apiHealthy ? "在线" : "离线"}
									</p>
								</div>
								<span
									className={`h-2 w-2 rounded-full ${
										apiHealthy ? "bg-emerald-500" : "bg-red-500"
									}`}
								/>
							</div>
						</CardContent>
					</Card>
				</section>

				<section className="space-y-4">
					<div className="space-y-2">
						<h2 className="text-2xl font-semibold">产品亮点</h2>
						<p className="text-sm text-muted-foreground">
							围绕图片生产的关键节点，cyop 提供可插拔模块，确保体验一致。
						</p>
					</div>
					<div className="grid gap-4 md:grid-cols-2">
						{features.map((feature) => (
							<Card key={feature.title} className="bg-card/70">
								<CardHeader className="space-y-3">
									<Badge variant="secondary" className="w-fit gap-2">
										{feature.icon}
										<span>模块</span>
									</Badge>
									<CardTitle>{feature.title}</CardTitle>
									<CardDescription>{feature.description}</CardDescription>
								</CardHeader>
							</Card>
						))}
					</div>
				</section>
			</div>
		</div>
	);
}
