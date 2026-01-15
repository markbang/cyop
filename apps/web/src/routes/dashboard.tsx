import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Input,
	Progress,
	Select,
	Textarea,
} from "@cyop/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	AlertTriangle,
	CheckCircle2,
	ChevronRight,
	ClipboardList,
	Database,
	Layers,
	LayoutDashboard,
	Loader2,
	Play,
	Plus,
	RefreshCcw,
	Sparkles,
	Tag,
	Users2,
} from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/dashboard")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data) {
			redirect({
				to: "/login",
				throw: true,
			});
		}

		return { session };
	},
	component: DashboardView,
});

const statusOrder = [
	"intake",
	"design",
	"sourcing",
	"labeling",
	"qa",
	"completed",
	"blocked",
] as const;

const statusCopy: Record<
	(typeof statusOrder)[number],
	{ label: string; helper: string }
> = {
	intake: { label: "需求收集", helper: "等待评估" },
	design: { label: "方案设计", helper: "定义规则" },
	sourcing: { label: "素材采集", helper: "数据回收" },
	labeling: { label: "智能打标", helper: "AI/人工协作" },
	qa: { label: "质检验收", helper: "检查一致性" },
	completed: { label: "已发布", helper: "可复用资产" },
	blocked: { label: "阻塞", helper: "需要支援" },
};

const taskTypes = ["ingest", "caption", "tag", "qa", "distribution"] as const;
const taskStatusValues = [
	"queued",
	"running",
	"paused",
	"succeeded",
	"failed",
	"blocked",
] as const;

const getStatusBadgeStyles = (status: string) => {
	switch (status) {
		case "intake":
		case "design":
			return "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100";
		case "sourcing":
		case "labeling":
			return "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100";
		case "qa":
		case "paused":
		case "warning":
		case "medium":
			return "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100";
		case "completed":
		case "succeeded":
		case "low":
			return "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100";
		case "blocked":
		case "failed":
		case "urgent":
		case "high":
		case "destructive":
			return "bg-red-100 text-red-700 border-red-200 hover:bg-red-100";
		case "running":
			return "bg-blue-50 text-blue-600 border-blue-100 animate-pulse";
		case "queued":
			return "bg-slate-100 text-slate-500 border-slate-200";
		default:
			return "bg-slate-100 text-slate-600 border-slate-200";
	}
};

function DashboardView() {
	const { session } = Route.useRouteContext();
	const createPanelRef = useRef<HTMLDivElement>(null);
	const [formState, setFormState] = useState({
		title: "",
		description: "",
		owner: "",
		team: "",
		expectedImages: 1000,
		aiCoverageTarget: 80,
		priority: "medium",
		tagHints: "",
	});
	const [datasetForm, setDatasetForm] = useState({
		requirementId: "",
		name: "",
		storageBucket: "",
		imageCount: "0",
		processedCount: "0",
		aiCaptionCoverage: "0",
		autoTagCoverage: "0",
		reviewCoverage: "0",
		focusTags: "",
	});
	const [taskForm, setTaskForm] = useState({
		datasetId: "",
		type: "caption",
		status: "queued",
		progress: "0",
		assignedTo: "",
	});

	const requirementQuery = useQuery(trpc.requirement.list.queryOptions());
	const statsQuery = useQuery(trpc.requirement.stats.queryOptions());
	const datasetQuery = useQuery(trpc.dataset.list.queryOptions());
	const taskQuery = useQuery(trpc.task.list.queryOptions());
	const tagQuery = useQuery(trpc.tag.list.queryOptions());

	const createRequirement = useMutation(
		trpc.requirement.create.mutationOptions({
			onSuccess: () => {
				requirementQuery.refetch();
				statsQuery.refetch();
				setFormState((prev) => ({
					...prev,
					title: "",
					description: "",
					tagHints: "",
				}));
			},
		}),
	);
	const updateRequirementStatus = useMutation(
		trpc.requirement.updateStatus.mutationOptions({
			onSuccess: () => {
				requirementQuery.refetch();
				statsQuery.refetch();
			},
		}),
	);
	const createDataset = useMutation(
		trpc.dataset.create.mutationOptions({
			onSuccess: () => {
				datasetQuery.refetch();
				statsQuery.refetch();
				setDatasetForm({
					requirementId: "",
					name: "",
					storageBucket: "",
					imageCount: "0",
					processedCount: "0",
					aiCaptionCoverage: "0",
					autoTagCoverage: "0",
					reviewCoverage: "0",
					focusTags: "",
				});
			},
		}),
	);
	const createTask = useMutation(
		trpc.task.create.mutationOptions({
			onSuccess: () => {
				taskQuery.refetch();
				setTaskForm({
					datasetId: "",
					type: "caption",
					status: "queued",
					progress: "0",
					assignedTo: "",
				});
			},
		}),
	);
	const updateTaskStatus = useMutation(
		trpc.task.updateStatus.mutationOptions({
			onSuccess: () => {
				taskQuery.refetch();
			},
		}),
	);

	const requirements = requirementQuery.data ?? [];
	const datasets = datasetQuery.data ?? [];
	const tasks = taskQuery.data ?? [];
	const tags = tagQuery.data ?? [];
	const stats = statsQuery.data;

	const groupedRequirements = useMemo(() => {
		type RequirementRow = (typeof requirements)[number];
		const groups = statusOrder.reduce(
			(acc, status) => {
				acc[status] = [];
				return acc;
			},
			{} as Record<(typeof statusOrder)[number], RequirementRow[]>,
		);

		requirements.forEach((item) => {
			if (statusOrder.includes(item.status as (typeof statusOrder)[number])) {
				groups[item.status as (typeof statusOrder)[number]].push(item);
			} else {
				groups.intake.push(item);
			}
		});

		return groups;
	}, [requirements]);

	const ownerSummary = useMemo(() => {
		const map = new Map<string, number>();
		requirements.forEach((item) => {
			map.set(item.owner, (map.get(item.owner) ?? 0) + 1);
		});
		return Array.from(map.entries())
			.map(([owner, count]) => ({ owner, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 4);
	}, [requirements]);

	const handleCreateRequirement = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const tagHints = formState.tagHints
			.split(",")
			.map((tag) => tag.trim())
			.filter(Boolean);
		createRequirement.mutate({
			title: formState.title,
			description: formState.description,
			owner: formState.owner,
			team: formState.team,
			expectedImages: formState.expectedImages,
			aiCoverageTarget: formState.aiCoverageTarget,
			priority: formState.priority as "low" | "medium" | "high" | "urgent",
			tagHints,
		});
	};

	const handleCreateDataset = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!datasetForm.requirementId) {
			return;
		}
		const focusTags = datasetForm.focusTags
			.split(",")
			.map((tag) => tag.trim())
			.filter(Boolean);
		createDataset.mutate({
			requirementId: Number(datasetForm.requirementId),
			name: datasetForm.name,
			storageBucket: datasetForm.storageBucket,
			imageCount: Number(datasetForm.imageCount),
			processedCount: Number(datasetForm.processedCount),
			aiCaptionCoverage: Number(datasetForm.aiCaptionCoverage),
			autoTagCoverage: Number(datasetForm.autoTagCoverage),
			reviewCoverage: Number(datasetForm.reviewCoverage),
			focusTags,
		});
	};

	const handleCreateTask = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!taskForm.datasetId) {
			return;
		}
		createTask.mutate({
			datasetId: Number(taskForm.datasetId),
			type: taskForm.type as (typeof taskTypes)[number],
			status: taskForm.status as (typeof taskStatusValues)[number],
			progress: Number(taskForm.progress),
			assignedTo: taskForm.assignedTo || undefined,
		});
	};

	const refreshAll = () => {
		requirementQuery.refetch();
		statsQuery.refetch();
		datasetQuery.refetch();
		taskQuery.refetch();
		tagQuery.refetch();
	};

	return (
		<div className="min-h-screen bg-slate-50 text-slate-900">
			<div className="mx-auto flex max-w-[1600px] flex-col gap-8 p-6 md:p-8">
				<section className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/80 p-6 shadow-sm backdrop-blur-xl transition-all hover:shadow-md">
					<div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-transparent opacity-50" />
					<div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
						<div className="space-y-4">
							<div className="flex items-center gap-3">
								<div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-blue-600/20 shadow-lg">
									<LayoutDashboard className="size-5" />
								</div>
								<div>
									<h1 className="font-bold text-2xl text-slate-900 tracking-tight lg:text-3xl">
										CYOP 控制塔
									</h1>
									<p className="flex items-center gap-2 text-slate-500 text-sm">
										<span className="inline-block size-2 rounded-full bg-emerald-500" />
										图像生产全链路 · 实时调度
									</p>
								</div>
							</div>
							<p className="max-w-2xl text-slate-600 text-sm leading-relaxed">
								集中管理需求、数据集与自动化任务，追踪 AI
								Caption、标签覆盖率和批量处理进度。
							</p>
						</div>

						<div className="flex flex-wrap items-center gap-3">
							<Button
								variant="outline"
								onClick={refreshAll}
								className="border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
							>
								{statsQuery.isRefetching ? (
									<Loader2 className="mr-2 size-4 animate-spin text-blue-600" />
								) : (
									<RefreshCcw className="mr-2 size-4" />
								)}
								刷新数据
							</Button>
							<Button
								onClick={() =>
									createPanelRef.current?.scrollIntoView({ behavior: "smooth" })
								}
								className="bg-blue-600 text-white shadow-blue-600/20 shadow-lg transition-all hover:bg-blue-700 hover:shadow-blue-600/30"
							>
								<Plus className="mr-2 size-4" />
								创建新需求
							</Button>
						</div>
					</div>

					<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
						<SummaryCard
							label="活跃需求"
							value={stats?.totals.requirements ?? 0}
							description="覆盖所有状态"
							icon={<Layers className="size-5 text-blue-600" />}
							color="blue"
						/>
						<SummaryCard
							label="紧急任务"
							value={stats?.alerts.urgent ?? 0}
							description="需要立即关注"
							icon={<AlertTriangle className="size-5 text-orange-500" />}
							color="orange"
						/>
						<SummaryCard
							label="自动化成功率"
							value={`${stats?.automation.successRate ?? 0}%`}
							description={`${stats?.automation.running ?? 0} 运行中 / ${stats?.automation.blocked ?? 0} 阻塞`}
							icon={<CheckCircle2 className="size-5 text-emerald-500" />}
							color="emerald"
						/>
						<SummaryCard
							label="AI Caption"
							value={`${stats?.coverage.aiCaption ?? 0}%`}
							description="智能描述完成度"
							icon={<Sparkles className="size-5 text-indigo-500" />}
							color="indigo"
						/>
						<SummaryCard
							label="阻塞需求"
							value={stats?.alerts.blocked ?? 0}
							description="流程受阻"
							icon={<AlertTriangle className="size-5 text-red-500" />}
							color="red"
						/>
					</div>
				</section>

				<section className="space-y-6">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="font-semibold text-slate-900 text-xl tracking-tight">
								需求看板
							</h2>
							<p className="mt-1 text-slate-500 text-sm">
								全流程可视化管理，拖拽式布局（待实现）可快速获知瓶颈。
							</p>
						</div>
						<Button
							variant="link"
							className="text-blue-600 hover:text-blue-700"
							onClick={refreshAll}
						>
							查看最新
							<ChevronRight className="ml-1 size-4" />
						</Button>
					</div>

					<div className="grid gap-4 overflow-x-auto pb-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
						{statusOrder.map((status) => {
							const requirementsInColumn = groupedRequirements[status] ?? [];
							const isSpecial =
								status === "completed" ||
								status === "blocked" ||
								status === "qa";
							return (
								<div
									key={status}
									className={`flex min-w-[280px] flex-col rounded-xl border p-1 ${
										isSpecial
											? "border-slate-200 bg-slate-50/50"
											: "border-transparent bg-transparent"
									}`}
								>
									<div className="mb-3 flex items-center justify-between px-2 pt-2">
										<div>
											<h3 className="font-semibold text-slate-700 text-sm">
												{statusCopy[status].label}
											</h3>
											<p className="text-slate-400 text-xs">
												{statusCopy[status].helper}
											</p>
										</div>
										<Badge
											variant="outline"
											className={`${getStatusBadgeStyles(status)} border px-2 py-0.5 font-mono text-xs`}
										>
											{requirementsInColumn.length}
										</Badge>
									</div>

									<div className="flex flex-1 flex-col gap-3 overflow-y-auto px-1">
										{requirementsInColumn.length === 0 ? (
											<div className="flex h-24 items-center justify-center rounded-lg border border-slate-200 border-dashed bg-slate-50/50">
												<span className="text-slate-400 text-xs">空</span>
											</div>
										) : (
											requirementsInColumn.map((requirement) => (
												<div
													key={requirement.id}
													className="group relative flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
												>
													<div className="flex items-start justify-between gap-2">
														<div>
															<h4 className="line-clamp-2 font-medium text-slate-900 text-sm leading-snug transition-colors group-hover:text-blue-600">
																{requirement.title}
															</h4>
															<div className="mt-1 flex items-center gap-2 text-slate-500 text-xs">
																<Users2 className="size-3" />
																<span>{requirement.owner}</span>
																<span className="text-slate-300">|</span>
																<span>{requirement.team}</span>
															</div>
														</div>
														{requirement.priority !== "medium" && (
															<Badge
																variant="outline"
																className={`shrink-0 text-[10px] uppercase ${getStatusBadgeStyles(requirement.priority)}`}
															>
																{requirement.priority}
															</Badge>
														)}
													</div>

													<p className="line-clamp-2 text-slate-600 text-xs">
														{requirement.description}
													</p>

													<div className="flex flex-wrap gap-1">
														{requirement.tagHints.length > 0 ? (
															requirement.tagHints.slice(0, 3).map((tag) => (
																<span
																	key={tag}
																	className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-medium text-[10px] text-slate-600"
																>
																	#{tag}
																</span>
															))
														) : (
															<span className="text-[10px] text-slate-400 italic">
																无标签
															</span>
														)}
													</div>

													<div className="mt-1 grid grid-cols-2 gap-2 border-slate-100 border-t pt-2">
														<div className="text-center">
															<p className="font-medium font-mono text-slate-700 text-xs">
																{requirement.expectedImages}
															</p>
															<p className="text-[10px] text-slate-400">
																目标量
															</p>
														</div>
														<div className="text-center">
															<p className="font-medium font-mono text-blue-600 text-xs">
																{requirement.aiCoverageTarget}%
															</p>
															<p className="text-[10px] text-slate-400">
																AI 目标
															</p>
														</div>
													</div>

													<Select
														value={requirement.status}
														onChange={(e: ChangeEvent<HTMLSelectElement>) =>
															updateRequirementStatus.mutate({
																id: requirement.id,
																status: e.target
																	.value as (typeof statusOrder)[number],
															})
														}
														disabled={updateRequirementStatus.isPending}
														className="mt-1 h-7 w-full border-slate-200 bg-slate-50 text-xs focus:border-blue-500 focus:ring-blue-100"
													>
														{statusOrder.map((val) => (
															<option key={val} value={val}>
																{statusCopy[val].label}
															</option>
														))}
													</Select>
												</div>
											))
										)}
									</div>
								</div>
							);
						})}
					</div>
				</section>

				<section className="grid gap-8 lg:grid-cols-[2fr_1fr]">
					<Card className="border-slate-200 shadow-sm">
						<CardHeader className="border-slate-100 border-b bg-slate-50/50 px-6 py-4">
							<div className="flex items-center gap-2">
								<Database className="size-5 text-blue-500" />
								<div>
									<CardTitle className="text-base text-slate-800">
										数据集健康度
									</CardTitle>
									<CardDescription className="text-slate-500 text-xs">
										总览 AI Caption、标签覆盖率与待处理容量
									</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent className="p-0">
							<div className="overflow-x-auto">
								<table className="w-full text-left text-sm">
									<thead className="bg-slate-50 text-slate-500 text-xs uppercase">
										<tr>
											<th className="px-6 py-3 font-medium">数据集</th>
											<th className="px-6 py-3 font-medium">进度概览</th>
											<th className="px-6 py-3 text-center font-medium">
												AI Caption
											</th>
											<th className="px-6 py-3 text-center font-medium">
												Tags
											</th>
											<th className="px-6 py-3 text-right font-medium">
												存储 Bucket
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{datasets.length === 0 ? (
											<tr>
												<td
													colSpan={5}
													className="py-8 text-center text-slate-500"
												>
													暂无数据
												</td>
											</tr>
										) : (
											datasets.map((dataset) => {
												const pendingRate =
													dataset.imageCount === 0
														? 0
														: Math.round(
																(dataset.pendingCount / dataset.imageCount) *
																	100,
															);
												return (
													<tr
														key={dataset.id}
														className="group transition-colors hover:bg-slate-50/60"
													>
														<td className="px-6 py-4">
															<p className="font-medium text-slate-900 transition-colors group-hover:text-blue-600">
																{dataset.name}
															</p>
															<p className="text-slate-500 text-xs">
																{dataset.requirement?.title ?? "未关联需求"}
															</p>
														</td>
														<td className="px-6 py-4">
															<div className="flex flex-col gap-1">
																<div className="flex justify-between text-xs">
																	<span className="text-slate-500">
																		处理进度
																	</span>
																	<span className="font-medium text-slate-700">
																		{100 - pendingRate}%
																	</span>
																</div>
																<Progress
																	value={100 - pendingRate}
																	className="h-1.5 bg-slate-100"
																	indicatorClassName="bg-blue-500"
																/>
															</div>
														</td>
														<td className="px-6 py-4 text-center">
															<div className="inline-flex flex-col items-center">
																<span className="font-medium font-mono text-slate-700">
																	{dataset.aiCaptionCoverage}%
																</span>
																<Progress
																	value={dataset.aiCaptionCoverage}
																	className="mt-1 h-1 w-16 bg-slate-100"
																	indicatorClassName="bg-indigo-500"
																/>
															</div>
														</td>
														<td className="px-6 py-4 text-center">
															<div className="inline-flex flex-col items-center">
																<span className="font-medium font-mono text-slate-700">
																	{dataset.autoTagCoverage}%
																</span>
																<Progress
																	value={dataset.autoTagCoverage}
																	className="mt-1 h-1 w-16 bg-slate-100"
																	indicatorClassName="bg-emerald-500"
																/>
															</div>
														</td>
														<td className="px-6 py-4 text-right font-mono text-slate-500 text-xs">
															{dataset.storageBucket}
														</td>
													</tr>
												);
											})
										)}
									</tbody>
								</table>
							</div>
						</CardContent>
					</Card>

					<div ref={createPanelRef} className="flex flex-col">
						<Card className="flex-1 border-slate-200 shadow-sm">
							<CardHeader className="border-slate-100 border-b bg-slate-50/50 px-6 py-4">
								<div className="flex items-center gap-2">
									<Plus className="size-5 text-orange-500" />
									<div>
										<CardTitle className="text-base text-slate-800">
											快速创建需求
										</CardTitle>
										<CardDescription className="text-slate-500 text-xs">
											生成需求与数据集骨架
										</CardDescription>
									</div>
								</div>
							</CardHeader>
							<CardContent className="p-6">
								<form className="space-y-4" onSubmit={handleCreateRequirement}>
									<div className="space-y-2">
										<Input
											required
											placeholder="需求标题"
											className="border-slate-200 focus:border-blue-500 focus:ring-blue-100"
											value={formState.title}
											onChange={(e: ChangeEvent<HTMLInputElement>) =>
												setFormState({ ...formState, title: e.target.value })
											}
										/>
										<Textarea
											required
											placeholder="需求背景、业务目标..."
											className="min-h-[80px] border-slate-200 focus:border-blue-500 focus:ring-blue-100"
											value={formState.description}
											onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
												setFormState({
													...formState,
													description: e.target.value,
												})
											}
										/>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<Input
											required
											placeholder="Owner"
											className="border-slate-200"
											value={formState.owner}
											onChange={(e: ChangeEvent<HTMLInputElement>) =>
												setFormState({ ...formState, owner: e.target.value })
											}
										/>
										<Input
											required
											placeholder="团队/渠道"
											className="border-slate-200"
											value={formState.team}
											onChange={(e: ChangeEvent<HTMLInputElement>) =>
												setFormState({ ...formState, team: e.target.value })
											}
										/>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-1">
											<p className="text-[10px] text-slate-500 uppercase tracking-wider">
												期望图片量
											</p>
											<Input
												type="number"
												min={0}
												className="border-slate-200"
												value={formState.expectedImages}
												onChange={(e: ChangeEvent<HTMLInputElement>) =>
													setFormState({
														...formState,
														expectedImages: Number(e.target.value),
													})
												}
											/>
										</div>
										<div className="space-y-1">
											<p className="text-[10px] text-slate-500 uppercase tracking-wider">
												AI 覆盖目标 %
											</p>
											<Input
												type="number"
												min={0}
												max={100}
												className="border-slate-200"
												value={formState.aiCoverageTarget}
												onChange={(e: ChangeEvent<HTMLInputElement>) =>
													setFormState({
														...formState,
														aiCoverageTarget: Number(e.target.value),
													})
												}
											/>
										</div>
									</div>

									<div className="space-y-2">
										<Select
											value={formState.priority}
											onChange={(e: ChangeEvent<HTMLSelectElement>) =>
												setFormState({
													...formState,
													priority: e.target.value,
												})
											}
											className="border-slate-200"
										>
											<option value="low">低优先级</option>
											<option value="medium">标准</option>
											<option value="high">高优先级</option>
											<option value="urgent">加急</option>
										</Select>
										<Input
											placeholder="标签提示 (逗号分隔)"
											className="border-slate-200"
											value={formState.tagHints}
											onChange={(e: ChangeEvent<HTMLInputElement>) =>
												setFormState({ ...formState, tagHints: e.target.value })
											}
										/>
									</div>

									<Button
										type="submit"
										disabled={createRequirement.isPending}
										className="w-full bg-slate-900 text-white hover:bg-slate-800"
									>
										{createRequirement.isPending ? (
											<Loader2 className="mr-2 size-4 animate-spin" />
										) : (
											<Plus className="mr-2 size-4" />
										)}
										创建需求
									</Button>
								</form>
							</CardContent>
						</Card>
					</div>
				</section>

				<section className="grid gap-8 lg:grid-cols-2">
					<Card className="border-slate-200 shadow-sm">
						<CardHeader className="border-slate-100 border-b bg-slate-50/50 px-6 py-4">
							<div className="flex items-center gap-2">
								<Database className="size-5 text-indigo-500" />
								<div>
									<CardTitle className="text-base text-slate-800">
										创建数据集
									</CardTitle>
									<CardDescription className="text-slate-500 text-xs">
										绑定需求，配置存储与目标
									</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent className="p-6">
							<form className="space-y-4" onSubmit={handleCreateDataset}>
								<div className="grid gap-4 sm:grid-cols-2">
									<Select
										required
										value={datasetForm.requirementId}
										onChange={(e: ChangeEvent<HTMLSelectElement>) =>
											setDatasetForm({
												...datasetForm,
												requirementId: e.target.value,
											})
										}
										className="border-slate-200"
									>
										<option value="">选择关联需求...</option>
										{requirements.map((req) => (
											<option key={req.id} value={req.id}>
												{req.title}
											</option>
										))}
									</Select>
									<Input
										required
										placeholder="数据集名称"
										className="border-slate-200"
										value={datasetForm.name}
										onChange={(e: ChangeEvent<HTMLInputElement>) =>
											setDatasetForm({ ...datasetForm, name: e.target.value })
										}
									/>
								</div>
								<Input
									required
									placeholder="存储 Bucket (s3://...)"
									className="border-slate-200 font-mono text-sm"
									value={datasetForm.storageBucket}
									onChange={(e: ChangeEvent<HTMLInputElement>) =>
										setDatasetForm({
											...datasetForm,
											storageBucket: e.target.value,
										})
									}
								/>
								<div className="grid grid-cols-3 gap-3">
									<Input
										type="number"
										placeholder="总数"
										className="border-slate-200"
										value={datasetForm.imageCount}
										onChange={(e: ChangeEvent<HTMLInputElement>) =>
											setDatasetForm({
												...datasetForm,
												imageCount: e.target.value,
											})
										}
									/>
									<Input
										type="number"
										placeholder="已处理"
										className="border-slate-200"
										value={datasetForm.processedCount}
										onChange={(e: ChangeEvent<HTMLInputElement>) =>
											setDatasetForm({
												...datasetForm,
												processedCount: e.target.value,
											})
										}
									/>
									<Input
										placeholder="关注标签"
										className="border-slate-200"
										value={datasetForm.focusTags}
										onChange={(e: ChangeEvent<HTMLInputElement>) =>
											setDatasetForm({
												...datasetForm,
												focusTags: e.target.value,
											})
										}
									/>
								</div>
								<div className="grid grid-cols-3 gap-3">
									<Input
										type="number"
										placeholder="Cap %"
										className="border-slate-200"
										value={datasetForm.aiCaptionCoverage}
										onChange={(e: ChangeEvent<HTMLInputElement>) =>
											setDatasetForm({
												...datasetForm,
												aiCaptionCoverage: e.target.value,
											})
										}
									/>
									<Input
										type="number"
										placeholder="Tag %"
										className="border-slate-200"
										value={datasetForm.autoTagCoverage}
										onChange={(e: ChangeEvent<HTMLInputElement>) =>
											setDatasetForm({
												...datasetForm,
												autoTagCoverage: e.target.value,
											})
										}
									/>
									<Input
										type="number"
										placeholder="Rev %"
										className="border-slate-200"
										value={datasetForm.reviewCoverage}
										onChange={(e: ChangeEvent<HTMLInputElement>) =>
											setDatasetForm({
												...datasetForm,
												reviewCoverage: e.target.value,
											})
										}
									/>
								</div>
								<Button
									type="submit"
									className="w-full bg-indigo-600 text-white hover:bg-indigo-700"
									disabled={
										createDataset.isPending || requirements.length === 0
									}
								>
									{createDataset.isPending ? (
										<Loader2 className="mr-2 size-4 animate-spin" />
									) : (
										<Plus className="mr-2 size-4" />
									)}
									创建数据集
								</Button>
							</form>
						</CardContent>
					</Card>

					<Card className="border-slate-200 shadow-sm">
						<CardHeader className="border-slate-100 border-b bg-slate-50/50 px-6 py-4">
							<div className="flex items-center gap-2">
								<ClipboardList className="size-5 text-emerald-500" />
								<div>
									<CardTitle className="text-base text-slate-800">
										调度任务
									</CardTitle>
									<CardDescription className="text-slate-500 text-xs">
										发送请求至后端编排系统
									</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent className="p-6">
							<form className="space-y-4" onSubmit={handleCreateTask}>
								<Select
									required
									value={taskForm.datasetId}
									onChange={(e: ChangeEvent<HTMLSelectElement>) =>
										setTaskForm({ ...taskForm, datasetId: e.target.value })
									}
									className="border-slate-200"
								>
									<option value="">选择数据集...</option>
									{datasets.map((ds) => (
										<option key={ds.id} value={ds.id}>
											{ds.name}
										</option>
									))}
								</Select>

								<div className="grid grid-cols-2 gap-4">
									<Select
										value={taskForm.type}
										onChange={(e: ChangeEvent<HTMLSelectElement>) =>
											setTaskForm({ ...taskForm, type: e.target.value })
										}
										className="border-slate-200"
									>
										{taskTypes.map((t) => (
											<option key={t} value={t}>
												{t.toUpperCase()}
											</option>
										))}
									</Select>
									<Select
										value={taskForm.status}
										onChange={(e: ChangeEvent<HTMLSelectElement>) =>
											setTaskForm({ ...taskForm, status: e.target.value })
										}
										className="border-slate-200"
									>
										{taskStatusValues.map((s) => (
											<option key={s} value={s}>
												{s.toUpperCase()}
											</option>
										))}
									</Select>
								</div>

								<div className="grid grid-cols-[1fr_auto] gap-4">
									<Input
										type="number"
										min={0}
										max={100}
										placeholder="进度 %"
										className="border-slate-200"
										value={taskForm.progress}
										onChange={(e: ChangeEvent<HTMLInputElement>) =>
											setTaskForm({ ...taskForm, progress: e.target.value })
										}
									/>
									<Input
										placeholder="负责人"
										className="w-32 border-slate-200"
										value={taskForm.assignedTo}
										onChange={(e: ChangeEvent<HTMLInputElement>) =>
											setTaskForm({ ...taskForm, assignedTo: e.target.value })
										}
									/>
								</div>

								<Button
									type="submit"
									className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
									disabled={createTask.isPending || datasets.length === 0}
								>
									{createTask.isPending ? (
										<Loader2 className="mr-2 size-4 animate-spin" />
									) : (
										<Play className="mr-2 size-4" />
									)}
									立即调度
								</Button>
							</form>
						</CardContent>
					</Card>
				</section>

				<section className="grid gap-8 lg:grid-cols-[2fr_1fr]">
					<Card className="overflow-hidden border-slate-200 shadow-sm">
						<CardHeader className="border-slate-100 border-b bg-slate-50/50 px-6 py-4">
							<CardTitle className="text-base text-slate-800">
								自动化任务队列
							</CardTitle>
						</CardHeader>
						<CardContent className="p-0">
							<div className="overflow-x-auto">
								<table className="w-full text-left text-sm">
									<thead className="bg-slate-50 text-slate-500 text-xs uppercase">
										<tr>
											<th className="px-6 py-3 font-medium">任务类型</th>
											<th className="px-6 py-3 font-medium">数据集</th>
											<th className="px-6 py-3 font-medium">状态</th>
											<th className="px-6 py-3 text-center font-medium">
												进度
											</th>
											<th className="px-6 py-3 text-right font-medium">
												负责人
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{tasks.length === 0 ? (
											<tr>
												<td
													colSpan={5}
													className="py-8 text-center text-slate-500"
												>
													暂无任务
												</td>
											</tr>
										) : (
											tasks.slice(0, 8).map((task) => (
												<tr
													key={task.id}
													className="transition-colors hover:bg-slate-50/60"
												>
													<td className="px-6 py-3 font-medium text-slate-800">
														{task.type.toUpperCase()}
													</td>
													<td className="px-6 py-3">
														<div className="flex flex-col">
															<span className="font-medium text-slate-700 text-xs">
																{task.dataset?.name}
															</span>
															<span className="text-[10px] text-slate-400">
																{task.requirement?.title ?? "-"}
															</span>
														</div>
													</td>
													<td className="px-6 py-3">
														<Select
															value={task.status}
															onChange={(e: ChangeEvent<HTMLSelectElement>) =>
																updateTaskStatus.mutate({
																	id: task.id,
																	status: e.target
																		.value as (typeof taskStatusValues)[number],
																})
															}
															disabled={updateTaskStatus.isPending}
															className="h-8 border-slate-200 text-xs"
														>
															{taskStatusValues.map((s) => (
																<option key={s} value={s}>
																	{s}
																</option>
															))}
														</Select>
													</td>
													<td className="px-6 py-3">
														<div className="flex items-center gap-2">
															<Progress
																value={task.progress}
																className="h-1.5 flex-1 bg-slate-100"
																indicatorClassName={
																	task.status === "failed"
																		? "bg-red-500"
																		: task.status === "succeeded"
																			? "bg-emerald-500"
																			: "bg-blue-500"
																}
															/>
															<span className="w-8 text-right font-mono text-slate-500 text-xs">
																{task.progress}%
															</span>
														</div>
													</td>
													<td className="px-6 py-3 text-right text-slate-600 text-xs">
														{task.assignedTo ?? "System"}
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</CardContent>
					</Card>

					<Card className="border-slate-200 shadow-sm">
						<CardHeader className="border-slate-100 border-b bg-slate-50/50 px-6 py-4">
							<div className="flex items-center justify-between">
								<CardTitle className="text-base text-slate-800">
									标签洞察
								</CardTitle>
								<Tag className="size-4 text-slate-400" />
							</div>
						</CardHeader>
						<CardContent className="space-y-3 p-6">
							{tags.length === 0 ? (
								<p className="text-center text-slate-500 text-sm">暂无数据</p>
							) : (
								tags.slice(0, 6).map((tag) => (
									<div
										key={tag.id}
										className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-3 transition-colors hover:border-slate-200 hover:bg-white"
									>
										<div>
											<p className="font-medium text-slate-700 text-sm">
												#{tag.label}
											</p>
											<p className="line-clamp-1 max-w-[120px] text-slate-400 text-xs">
												{tag.dataset?.name}
											</p>
										</div>
										<div className="text-right">
											<Badge
												variant="secondary"
												className="bg-blue-50 text-blue-700 hover:bg-blue-100"
											>
												{tag.coverage}%
											</Badge>
											<p className="mt-1 text-[10px] text-slate-400">
												{tag.usageCount} 次
											</p>
										</div>
									</div>
								))
							)}
						</CardContent>
					</Card>
				</section>

				<section>
					<div className="mb-4 flex items-center gap-2">
						<Users2 className="size-5 text-slate-400" />
						<h2 className="font-semibold text-lg text-slate-800">团队概览</h2>
					</div>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{ownerSummary.length === 0 ? (
							<div className="col-span-full rounded-lg border border-slate-200 border-dashed p-8 text-center text-slate-500">
								暂无成员数据
							</div>
						) : (
							ownerSummary.map((owner) => (
								<div
									key={owner.owner}
									className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
								>
									<div>
										<p className="text-slate-500 text-xs">负责人</p>
										<p className="font-semibold text-lg text-slate-900">
											{owner.owner}
										</p>
									</div>
									<div className="flex flex-col items-end">
										<Badge className="bg-slate-900 text-white hover:bg-slate-800">
											{owner.count} 需求
										</Badge>
									</div>
								</div>
							))
						)}
					</div>
				</section>
			</div>
		</div>
	);
}

type SummaryCardProps = {
	label: string;
	value: string | number;
	description: string;
	icon: ReactNode;
	color: "blue" | "orange" | "emerald" | "indigo" | "red";
};

function SummaryCard({
	label,
	value,
	description,
	icon,
	color,
}: SummaryCardProps) {
	const colorStyles = {
		blue: "bg-blue-50 text-blue-600 border-blue-100",
		orange: "bg-orange-50 text-orange-600 border-orange-100",
		emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
		indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
		red: "bg-red-50 text-red-600 border-red-100",
	};

	return (
		<Card className="group relative overflow-hidden border-slate-200 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
			<CardContent className="p-5">
				<div className="flex items-start justify-between">
					<div className="space-y-1">
						<p className="font-medium text-slate-500 text-xs uppercase tracking-wider">
							{label}
						</p>
						<p className="font-bold text-2xl text-slate-900 tracking-tight">
							{value}
						</p>
					</div>
					<div
						className={`rounded-xl border p-2.5 transition-colors group-hover:scale-110 ${colorStyles[color]}`}
					>
						{icon}
					</div>
				</div>
				<div className="mt-4 flex items-center text-slate-400 text-xs">
					{description}
				</div>
			</CardContent>
		</Card>
	);
}
