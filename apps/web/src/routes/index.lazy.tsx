import { Badge } from "@cyop/ui/components/badge";
import { Button } from "@cyop/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@cyop/ui/components/card";
import { Progress } from "@cyop/ui/components/progress";
import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import ArrowRight from "lucide-react/icons/arrow-right";
import Layers from "lucide-react/icons/layers";
import ShieldCheck from "lucide-react/icons/shield-check";
import Sparkles from "lucide-react/icons/sparkles";
import Users2 from "lucide-react/icons/users-2";
import { trpc } from "@/utils/trpc";

export const Route = createLazyFileRoute("/")({
	component: LandingPage,
});

function LandingPage() {
	const stats = useQuery(trpc.requirement.stats.queryOptions());
	const health = useQuery(trpc.healthCheck.queryOptions());
	const apiHealthy = health.data === "OK";

	const features = [
		{
			title: "统一需求与数据集模型",
			description:
				"打破业务与研发的技术壁垒，将每一个具体的算法打标任务与真实的业务目标无缝连接，确保数据采集、资产分类与下游模型训练所见即所得。",
			bullets: [
				"业务目标直接拆解为打标任务，全链路透明",
				"支持多数据集分类、聚合与素材一键分发",
				"跨系统沟通成本降低 80% 以上",
			],
			icon: <Layers className="size-4" />,
			badgeClass:
				"bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
			glowColor: "bg-blue-500",
			mockup: (
				<div className="space-y-4">
					<div className="flex items-center justify-between border-border/40 border-b pb-2">
						<span className="font-semibold text-foreground text-xs">
							Pipeline 数据管道
						</span>
						<Badge className="h-4 border-none bg-emerald-500/10 py-0 text-[9px] text-emerald-600 dark:text-emerald-400">
							运行中
						</Badge>
					</div>

					<div className="relative flex flex-col gap-3 text-xs md:flex-row md:items-center md:justify-between">
						{/* Node 1: Requirement */}
						<div className="flex-1 space-y-1 rounded-xl border border-border/80 bg-muted/40 p-3">
							<p className="font-medium text-[9px] text-muted-foreground uppercase tracking-wider">
								业务需求
							</p>
							<p className="truncate font-semibold text-foreground">
								电商秋季男装
							</p>
							<div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
								<Users2 className="size-3" />
								<span>张经理 · 创意部</span>
							</div>
						</div>

						{/* Arrow Connector */}
						<div className="flex rotate-90 items-center justify-center text-muted-foreground/50 md:rotate-0">
							<ArrowRight className="size-4 animate-pulse text-blue-500" />
						</div>

						{/* Node 2: Dataset */}
						<div className="flex-1 space-y-1 rounded-xl border border-border/80 bg-muted/40 p-3">
							<p className="font-medium text-[9px] text-muted-foreground uppercase tracking-wider">
								关联数据集
							</p>
							<p className="truncate font-semibold text-foreground">
								dataset_fall_2026
							</p>
							<div className="flex items-center justify-between text-[9px] text-muted-foreground">
								<span>进度: 65%</span>
								<span>420 / 600 张</span>
							</div>
						</div>

						{/* Arrow Connector */}
						<div className="flex rotate-90 items-center justify-center text-muted-foreground/50 md:rotate-0">
							<ArrowRight className="size-4 animate-pulse text-blue-500" />
						</div>

						{/* Node 3: Distribution */}
						<div className="flex-1 space-y-1 rounded-xl border border-border/80 bg-muted/40 p-3">
							<p className="font-medium text-[9px] text-muted-foreground uppercase tracking-wider">
								分发结果
							</p>
							<p className="truncate font-semibold text-foreground">
								OSS / HuggingFace
							</p>
							<div className="flex items-center gap-1 font-medium text-[9px] text-emerald-500">
								<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
								<span>同步完毕</span>
							</div>
						</div>
					</div>
				</div>
			),
		},
		{
			title: "AI Caption / 标签联动",
			description:
				"搭载多模态大语言模型，自动分析并快速提取图像的主体描述与细节属性。配合简洁直观的人工复核界面，以最轻的点击频次完成图像精准修剪。",
			bullets: [
				"AI 自动预打标，减少 90% 的纯人工手写输入",
				"内置置信度筛选器，自动标红异常及低置信度内容",
				"直观的通过与驳回反馈，单图审核仅需 1.2 秒",
			],
			icon: <Sparkles className="size-4" />,
			badgeClass:
				"bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
			glowColor: "bg-violet-500",
			mockup: (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					{/* Left: Simulated media card */}
					<div className="group relative overflow-hidden rounded-xl border border-border bg-muted/20">
						<div className="flex aspect-[4/3] flex-col items-center justify-center bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-pink-500/20 p-4 text-center">
							<Sparkles className="mb-1.5 size-8 text-violet-500" />
							<span className="font-medium text-[10px] text-muted-foreground">
								fashion_model_01.jpg
							</span>
						</div>
						<div className="absolute top-2 left-2">
							<Badge className="h-4 border-none bg-black/60 py-0 text-[8px] text-white backdrop-blur-sm">
								Confidence 98%
							</Badge>
						</div>
					</div>

					{/* Right: AI Analysis Panel */}
					<div className="flex flex-col justify-between space-y-3">
						<div className="space-y-1.5">
							<p className="font-medium text-[9px] text-muted-foreground uppercase tracking-wider">
								AI 自动标注标签
							</p>
							<div className="flex flex-wrap gap-1">
								<span className="rounded border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 font-medium text-[10px] text-violet-600 dark:text-violet-400">
									#秋季新品
								</span>
								<span className="rounded border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 font-medium text-[10px] text-violet-600 dark:text-violet-400">
									#夹克外套
								</span>
							</div>
						</div>

						<div className="space-y-1">
							<p className="font-medium text-[9px] text-muted-foreground uppercase tracking-wider">
								自动生成描述
							</p>
							<div className="rounded-lg border border-border bg-muted/40 p-2 font-sans text-[10px] text-muted-foreground italic leading-relaxed">
								"一名年轻男子在秋季街头漫步，身穿靛蓝色工装夹克与黑色长裤..."
							</div>
						</div>

						<div className="flex justify-end gap-1.5 border-border/40 border-t pt-1.5">
							<button
								type="button"
								className="rounded bg-red-500/10 px-3 py-1 font-medium text-red-600 text-xs transition-colors hover:bg-red-500/20"
							>
								驳回
							</button>
							<button
								type="button"
								className="rounded bg-emerald-500/10 px-3 py-1 font-medium text-emerald-600 text-xs transition-colors hover:bg-emerald-500/20"
							>
								通过
							</button>
						</div>
					</div>
				</div>
			),
		},
		{
			title: "批量任务调度",
			description:
				"内置高性能队列调度引擎，支持多任务、高并发的异步处理。无论是一键生成上万张图片的 AI 描述，还是海量数据的质检与打标，后台进程排队运行，不阻塞前台业务。",
			bullets: [
				"多线程并发，秒级响应，任务故障自动重试与补偿",
				"实时可视化的任务进度条，速度、队列一目了然",
				"自动审计与日志记录，确保每次任务运行有迹可循",
			],
			icon: <ShieldCheck className="size-4" />,
			badgeClass:
				"bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
			glowColor: "bg-emerald-500",
			mockup: (
				<div className="space-y-3">
					<div className="flex items-center justify-between border-border/40 border-b pb-2 text-muted-foreground text-xs">
						<span>正在运行的批处理队列</span>
						<span className="font-mono">吞吐量: 24 img/s</span>
					</div>

					<div className="space-y-2">
						{/* Job 1 */}
						<div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/30 p-3">
							<div className="flex items-center justify-between text-xs">
								<div className="flex items-center gap-2">
									<span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
									<span className="font-semibold text-foreground">
										Batch_Captioning_v4
									</span>
								</div>
								<span className="font-medium font-mono text-blue-500">
									82% (344/420)
								</span>
							</div>
							<div className="h-1.5 w-full overflow-hidden rounded bg-muted">
								<div className="h-full w-[82%] bg-gradient-to-r from-blue-500 to-indigo-500" />
							</div>
						</div>

						{/* Job 2 */}
						<div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/30 p-3">
							<div className="flex items-center justify-between text-xs">
								<div className="flex items-center gap-2">
									<span className="h-2 w-2 rounded-full bg-emerald-500" />
									<span className="font-semibold text-foreground">
										Tagging_ResNet_v2
									</span>
								</div>
								<span className="font-medium font-mono text-emerald-500">
									100% 已就绪
								</span>
							</div>
							<div className="h-1.5 w-full overflow-hidden rounded bg-muted">
								<div className="h-full w-full bg-emerald-500" />
							</div>
						</div>
					</div>
				</div>
			),
		},
		{
			title: "灵活的协作权限",
			description:
				"专为多方协作流设计。外包商只能上传和修改，内部审核组拥有快速通过与驳回权，业务运营能实时洞察覆盖面与质检合格率。搭载 Better-Auth 深度保护数据隐私。",
			bullets: [
				"细粒度角色与操作控制权限，确保资产所有权安全",
				"Better-Auth 安全保护，一键邀请、双因子安全登录",
				"直观的供应商协作看板，杜绝敏感密钥泄漏",
			],
			icon: <Users2 className="size-4" />,
			badgeClass:
				"bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
			glowColor: "bg-amber-500",
			mockup: (
				<div className="space-y-4">
					<div className="flex items-center justify-between border-border/40 border-b pb-2">
						<span className="font-semibold text-foreground text-xs">
							用户权限与角色矩阵
						</span>
						<Badge className="h-4 border-none bg-amber-500/10 py-0 text-[9px] text-amber-600 dark:text-amber-400">
							Better-Auth 校验
						</Badge>
					</div>

					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead>
								<tr className="border-border/40 border-b text-muted-foreground">
									<th className="pb-2 font-medium">协作者</th>
									<th className="pb-2 font-medium">角色组</th>
									<th className="pb-2 text-right font-medium">可操作权限</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/30">
								<tr className="hover:bg-muted/10">
									<td className="flex items-center gap-2 py-2">
										<div className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 font-semibold text-[8px] text-white">
											S
										</div>
										<span className="font-medium text-foreground">
											SuperAdmin
										</span>
									</td>
									<td className="py-2">
										<Badge className="h-4 border-none bg-blue-500/10 py-0 text-[8px] text-blue-600">
											超级管理员
										</Badge>
									</td>
									<td className="py-2 text-right text-[10px] text-muted-foreground">
										配置管理/全局读写
									</td>
								</tr>
								<tr className="hover:bg-muted/10">
									<td className="flex items-center gap-2 py-2">
										<div className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-purple-500 font-semibold text-[8px] text-white">
											A
										</div>
										<span className="font-medium text-foreground">Auditor</span>
									</td>
									<td className="py-2">
										<Badge className="h-4 border-none bg-violet-500/10 py-0 text-[8px] text-violet-600">
											审核专员
										</Badge>
									</td>
									<td className="py-2 text-right text-[10px] text-muted-foreground">
										数据审核与修正
									</td>
								</tr>
								<tr className="hover:bg-muted/10">
									<td className="flex items-center gap-2 py-2">
										<div className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 font-semibold text-[8px] text-white">
											O
										</div>
										<span className="font-medium text-foreground">Vendor</span>
									</td>
									<td className="py-2">
										<Badge className="h-4 border-none bg-emerald-500/10 py-0 text-[8px] text-emerald-600">
											外部代理商
										</Badge>
									</td>
									<td className="py-2 text-right text-[10px] text-muted-foreground">
										只读或单向上传
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			),
		},
	];

	return (
		<div className="relative min-h-full overflow-x-hidden bg-background">
			{/* Decorative background glow */}
			<div className="pointer-events-none absolute top-0 right-0 -z-10 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-blue-500/10 to-indigo-500/5 blur-[120px]" />
			<div className="pointer-events-none absolute bottom-10 left-0 -z-10 h-[400px] w-[400px] rounded-full bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 blur-[100px]" />

			<div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-16">
				<section className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
					<div className="space-y-6">
						<div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs backdrop-blur-sm">
							<span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
							<span className="font-medium text-muted-foreground">
								cyop · Creative Ops Platform
							</span>
						</div>

						<div className="space-y-4">
							<h1 className="bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text font-bold text-4xl text-transparent leading-tight tracking-tight sm:text-5xl">
								面向 AI 时代的图像资产管理与自动化协作平台
							</h1>
							<p className="text-base text-muted-foreground leading-relaxed sm:text-lg">
								从需求发起、图片采集、AI caption
								打标到批量质检与分发，全流程闭环在同一个一致的
								UI。通过实时指标、看板与自动任务调度，帮助团队快速沉淀优质资产。
							</p>
						</div>

						<div className="flex flex-wrap gap-3">
							<Button
								size="lg"
								className="shadow-blue-500/10 shadow-lg transition-all hover:translate-y-[-1px]"
								asChild
							>
								<Link to="/dashboard">
									进入控制塔
									<ArrowRight className="ml-2 size-4" />
								</Link>
							</Button>
							<Button
								size="lg"
								variant="outline"
								className="transition-all hover:bg-muted"
								asChild
							>
								<Link to="/login">邀请协作者</Link>
							</Button>
						</div>
					</div>

					<div className="relative space-y-6 rounded-2xl border border-border/60 bg-card/40 p-6 shadow-xl backdrop-blur-md lg:-mr-4">
						<div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-medium text-[9px] text-emerald-600 dark:text-emerald-400">
							<span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500" />
							<span>监控探针激活</span>
						</div>

						<div className="space-y-1 border-border/40 border-b pb-4">
							<h2 className="font-semibold text-base text-foreground">
								状态与运行控制台
							</h2>
							<p className="text-muted-foreground text-xs">
								实时抓取后端自动化任务和打标覆盖指标
							</p>
						</div>

						<div className="grid grid-cols-2 gap-4">
							{/* Metric 1 */}
							<div className="group relative space-y-2 overflow-hidden rounded-xl border border-border/40 bg-muted/20 p-3.5">
								<div className="flex items-start justify-between">
									<span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
										AI Caption 覆盖率
									</span>
									<Badge
										variant="outline"
										className="h-3.5 border-emerald-500/20 px-1 py-0 text-[8px] text-emerald-500"
									>
										正常
									</Badge>
								</div>
								<div className="flex items-baseline gap-0.5">
									<span className="font-bold font-mono text-3xl text-foreground tracking-tight">
										{stats.data ? `${stats.data.coverage.aiCaption}` : "--"}
									</span>
									<span className="text-[10px] text-muted-foreground">%</span>
								</div>
								<div className="h-1 w-full overflow-hidden rounded-full bg-muted">
									<div
										className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
										style={{ width: `${stats.data?.coverage.aiCaption ?? 0}%` }}
									/>
								</div>
								<p className="text-[8px] text-muted-foreground/80">
									已自动打标数据资产
								</p>
							</div>

							{/* Metric 2 */}
							<div className="group relative space-y-2 overflow-hidden rounded-xl border border-border/40 bg-muted/20 p-3.5">
								<div className="flex items-start justify-between">
									<span className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
										任务成功率
									</span>
									<Badge
										variant="outline"
										className="h-3.5 border-blue-500/20 px-1 py-0 text-[8px] text-blue-500"
									>
										高可用
									</Badge>
								</div>
								<div className="flex items-baseline gap-0.5">
									<span className="font-bold font-mono text-3xl text-foreground tracking-tight">
										{stats.data ? `${stats.data.automation.successRate}` : "--"}
									</span>
									<span className="text-[10px] text-muted-foreground">%</span>
								</div>
								<div className="h-1 w-full overflow-hidden rounded-full bg-muted">
									<div
										className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
										style={{
											width: `${stats.data?.automation.successRate ?? 0}%`,
										}}
									/>
								</div>
								<p className="text-[8px] text-muted-foreground/80">
									24H 批处理就绪度
								</p>
							</div>
						</div>

						<div className="space-y-3 rounded-xl border border-border/40 bg-muted/20 p-4">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<p className="font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
										API 边缘节点状态
									</p>
									<div className="mt-1 flex items-center gap-1.5">
										<span
											className={`h-2 w-2 rounded-full ${apiHealthy ? "animate-pulse bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500"}`}
										/>
										<span className="font-semibold text-foreground text-xs">
											{health.isLoading
												? "检测中..."
												: apiHealthy
													? "Gateway Online (在线)"
													: "Node Offline (离线)"}
										</span>
									</div>
								</div>
								<div className="text-right">
									<p className="text-[8px] text-muted-foreground">主网节点</p>
									<p className="mt-0.5 font-medium font-mono text-[10px] text-foreground">
										Tokyo-Edge-01
									</p>
								</div>
							</div>

							{/* Sparkline latency */}
							<div className="flex items-center justify-between gap-4 border-border/30 border-t pt-3">
								<div className="h-6 flex-1">
									<svg
										viewBox="0 0 100 20"
										className="h-full w-full overflow-visible text-emerald-500"
										aria-hidden="true"
									>
										<path
											d="M0,10 Q10,18 20,6 T40,14 T60,8 T80,12 L100,5"
											fill="none"
											stroke={
												apiHealthy
													? "rgba(16, 185, 129, 0.6)"
													: "rgba(239, 68, 68, 0.6)"
											}
											strokeWidth="1.5"
											strokeDasharray={apiHealthy ? "0" : "2 2"}
										/>
										{apiHealthy && (
											<>
												<circle
													cx="100"
													cy="5"
													r="2.5"
													fill="rgb(16, 185, 129)"
													className="animate-ping"
												/>
												<circle
													cx="100"
													cy="5"
													r="1.5"
													fill="rgb(16, 185, 129)"
												/>
											</>
										)}
									</svg>
								</div>
								<div className="shrink-0 font-mono text-[9px] text-muted-foreground/80">
									{apiHealthy ? "RTT: 14ms" : "RTT: --"}
								</div>
							</div>
						</div>
					</div>
				</section>

				<section className="space-y-12">
					<div className="space-y-2 text-center lg:text-left">
						<h2 className="font-semibold text-3xl tracking-tight">
							产品核心模块
						</h2>
						<p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">
							围绕图像全生命周期，提供高可用的协作界面，去除跨系统沟通成本。
						</p>
					</div>

					<div className="space-y-24">
						{features.map((feature, index) => {
							const textColumn = (
								<div className="space-y-4">
									<Badge
										variant="outline"
										className={`w-fit gap-1.5 py-0.5 font-medium text-[10px] ${feature.badgeClass}`}
									>
										{feature.icon}
										<span>模块 {index + 1}</span>
									</Badge>
									<h3 className="font-bold text-2xl text-foreground tracking-tight">
										{feature.title}
									</h3>
									<p className="text-muted-foreground text-sm leading-relaxed">
										{feature.description}
									</p>
									<ul className="space-y-2 pt-2">
										{feature.bullets.map((bullet) => (
											<li
												key={bullet}
												className="flex items-center gap-2 text-muted-foreground text-xs"
											>
												<span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
												<span>{bullet}</span>
											</li>
										))}
									</ul>
								</div>
							);

							const mockupColumn = (
								<div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-6 shadow-lg backdrop-blur-sm">
									{/* Decorative glow behind mockup */}
									<div
										className={`absolute -right-10 -bottom-10 -z-10 h-32 w-32 rounded-full opacity-10 blur-2xl ${feature.glowColor}`}
									/>
									{feature.mockup}
								</div>
							);

							return (
								<div
									key={feature.title}
									className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2"
								>
									{index % 2 === 0 ? (
										<>
											{textColumn}
											{mockupColumn}
										</>
									) : (
										<>
											<div className="lg:order-2">{textColumn}</div>
											<div className="w-full lg:order-1">{mockupColumn}</div>
										</>
									)}
								</div>
							);
						})}
					</div>
				</section>
			</div>
		</div>
	);
}
