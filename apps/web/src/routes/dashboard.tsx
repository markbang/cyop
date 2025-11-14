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

const priorityTone: Record<
	string,
	"default" | "secondary" | "warning" | "destructive"
> = {
	low: "secondary",
	medium: "default",
	high: "warning",
	urgent: "destructive",
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

const statusTone: Record<
	string,
	"default" | "secondary" | "success" | "warning" | "destructive"
> = {
	intake: "secondary",
	design: "secondary",
	sourcing: "default",
	labeling: "default",
	qa: "warning",
	completed: "success",
	blocked: "destructive",
	queued: "secondary",
	running: "default",
	paused: "warning",
	succeeded: "success",
	failed: "destructive",
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
		<div className="h-full overflow-y-auto bg-muted/10">
			<div className="mx-auto flex max-w-7xl flex-col gap-8 p-6">
				<section className="space-y-4 rounded-2xl border bg-card/80 p-6 shadow-sm">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="space-y-3">
							<Badge variant="outline">CYOP 控制塔</Badge>
							<div>
								<h1 className="font-semibold text-3xl tracking-tight">
									图像生产全链路 · 实时调度面板
								</h1>
								<p className="mt-2 max-w-2xl text-muted-foreground text-sm">
									集中管理需求、数据集与自动化任务，追踪 AI
									caption、标签覆盖率和批量处理进度， 让团队成员在统一 UI
									中协同推进。
								</p>
								<p className="text-muted-foreground text-xs">
									当前用户：{session.data?.user.email ?? session.data?.user.id}
								</p>
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Button variant="outline" size="sm" onClick={refreshAll}>
								{statsQuery.isRefetching ? (
									<Loader2 className="mr-2 size-4 animate-spin" />
								) : (
									<RefreshCcw className="mr-2 size-4" />
								)}
								刷新数据
							</Button>
							<Button
								size="sm"
								onClick={() => {
									createPanelRef.current?.scrollIntoView({
										behavior: "smooth",
									});
								}}
							>
								<Sparkles className="mr-2 size-4" />
								创建新需求
							</Button>
						</div>
					</div>

					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
						<SummaryCard
							label="活跃需求"
							value={stats?.totals.requirements ?? 0}
							description="覆盖所有状态"
							icon={<Users2 className="size-5 text-primary" />}
							highlight={`${stats?.alerts.urgent ?? 0} 个紧急`}
						/>
						<SummaryCard
							label="自动任务成功率"
							value={`${stats?.automation.successRate ?? 0}%`}
							description={`${stats?.automation.running ?? 0} 运行中 / ${
								stats?.automation.blocked ?? 0
							} 阻塞`}
							icon={<CheckCircle2 className="size-5 text-emerald-500" />}
						/>
						<SummaryCard
							label="平均 AI Caption 覆盖"
							value={`${stats?.coverage.aiCaption ?? 0}%`}
							description="智能描述完成度"
							icon={<Sparkles className="size-5 text-fuchsia-500" />}
						/>
						<SummaryCard
							label="待关注"
							value={`${(stats?.alerts.blocked ?? 0) + (stats?.alerts.urgent ?? 0)}`}
							description="阻塞或紧急需求"
							icon={<AlertTriangle className="size-5 text-amber-500" />}
						/>
					</div>
				</section>

				<section className="space-y-4">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div>
							<h2 className="font-semibold text-xl">需求看板</h2>
							<p className="text-muted-foreground text-sm">
								拖拽式布局可快速获知瓶颈，点击状态即可同步控制塔。
							</p>
						</div>
						<Button
							variant="link"
							className="px-0 text-primary"
							onClick={refreshAll}
						>
							查看最新进度
							<ChevronRight className="ml-1 size-4" />
						</Button>
					</div>
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
						{statusOrder.map((status) => {
							const requirementsInColumn = groupedRequirements[status] ?? [];
							return (
								<Card key={status} className="flex flex-col">
									<CardHeader className="pb-3">
										<div className="flex items-center justify-between">
											<div>
												<CardTitle className="text-base">
													{statusCopy[status].label}
												</CardTitle>
												<CardDescription>
													{statusCopy[status].helper}
												</CardDescription>
											</div>
											<Badge variant={statusTone[status]}>
												{requirementsInColumn.length}
											</Badge>
										</div>
									</CardHeader>
									<CardContent className="flex flex-1 flex-col gap-3 overflow-y-auto">
										{requirementsInColumn.length === 0 ? (
											<p className="text-muted-foreground text-sm">暂无卡片</p>
										) : (
											requirementsInColumn.map((requirement) => {
												return (
													<div
														key={requirement.id}
														className="space-y-3 rounded-xl border border-border/80 bg-card/80 p-3 shadow-xs transition hover:border-primary"
													>
														<div className="flex items-start justify-between gap-2">
															<div>
																<p className="font-medium">
																	{requirement.title}
																</p>
																<p className="text-muted-foreground text-xs">
																	{requirement.owner} · {requirement.team}
																</p>
															</div>
															<Badge
																variant={priorityTone[requirement.priority]}
															>
																{requirement.priority.toUpperCase()}
															</Badge>
														</div>
														<p className="line-clamp-3 text-muted-foreground text-sm">
															{requirement.description}
														</p>
														<div className="flex items-center gap-2 text-muted-foreground text-xs">
															<span>
																目标容量 {requirement.expectedImages} 张
															</span>
															<span>·</span>
															<span>
																AI 目标 {requirement.aiCoverageTarget}%
															</span>
														</div>
														<Select
															value={requirement.status}
															onChange={(
																event: ChangeEvent<HTMLSelectElement>,
															) =>
																updateRequirementStatus.mutate({
																	id: requirement.id,
																	status: event.target
																		.value as (typeof statusOrder)[number],
																})
															}
															disabled={updateRequirementStatus.isPending}
														>
															{statusOrder.map((value) => (
																<option key={value} value={value}>
																	{statusCopy[value].label}
																</option>
															))}
														</Select>
														<div className="flex flex-wrap gap-1">
															{requirement.tagHints.length > 0 ? (
																requirement.tagHints.map((tag) => (
																	<Badge key={tag} variant="secondary">
																		{tag}
																	</Badge>
																))
															) : (
																<span className="text-muted-foreground text-xs">
																	暂无标签提示
																</span>
															)}
														</div>
													</div>
												);
											})
										)}
									</CardContent>
								</Card>
							);
						})}
					</div>
				</section>

				<section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
					<Card>
						<CardHeader>
							<CardTitle>数据集健康度</CardTitle>
							<CardDescription>
								总览 AI
								caption、标签覆盖率与待处理容量，快速定位需提效的数据集。
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-5 items-center gap-4 font-medium text-muted-foreground text-xs">
								<span>数据集</span>
								<span className="text-center">AI Caption</span>
								<span className="text-center">标签</span>
								<span className="text-center">待处理</span>
								<span className="text-right">Bucket</span>
							</div>
							<div className="space-y-3">
								{datasets.length === 0 ? (
									<p className="text-muted-foreground text-sm">
										暂无数据集，先创建一个需求吧。
									</p>
								) : (
									datasets.map((dataset) => {
										const pendingRate =
											dataset.imageCount === 0
												? 0
												: Math.round(
														(dataset.pendingCount / dataset.imageCount) * 100,
													);
										return (
											<div
												key={dataset.id}
												className="grid grid-cols-5 items-center gap-4 rounded-xl border bg-card/70 p-3 text-sm"
											>
												<div>
													<p className="font-medium">{dataset.name}</p>
													<p className="text-muted-foreground text-xs">
														{dataset.requirement?.title ?? "未关联需求"}
													</p>
												</div>
												<div>
													<Progress value={dataset.aiCaptionCoverage} />
													<p className="mt-1 text-center text-muted-foreground text-xs">
														{dataset.aiCaptionCoverage}%
													</p>
												</div>
												<div>
													<Progress
														value={dataset.autoTagCoverage}
														className="bg-emerald-50"
													/>
													<p className="mt-1 text-center text-muted-foreground text-xs">
														{dataset.autoTagCoverage}%
													</p>
												</div>
												<div className="text-center text-muted-foreground text-xs">
													{dataset.pendingCount} 张 ({pendingRate}%)
												</div>
												<div className="text-right font-mono text-xs">
													{dataset.storageBucket}
												</div>
											</div>
										);
									})
								)}
							</div>
						</CardContent>
					</Card>

					<div ref={createPanelRef}>
						<Card>
							<CardHeader>
								<CardTitle>快速创建需求</CardTitle>
								<CardDescription>
									填写基础信息，即可同时生成需求、数据集骨架。
								</CardDescription>
							</CardHeader>
							<CardContent>
								<form className="space-y-3" onSubmit={handleCreateRequirement}>
									<Input
										required
										placeholder="需求标题"
										value={formState.title}
										onChange={(event: ChangeEvent<HTMLInputElement>) =>
											setFormState({ ...formState, title: event.target.value })
										}
									/>
									<Textarea
										required
										placeholder="需求背景、业务目标..."
										value={formState.description}
										onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
											setFormState({
												...formState,
												description: event.target.value,
											})
										}
									/>
									<div className="grid grid-cols-2 gap-3">
										<Input
											required
											placeholder="Owner"
											value={formState.owner}
											onChange={(event: ChangeEvent<HTMLInputElement>) =>
												setFormState({
													...formState,
													owner: event.target.value,
												})
											}
										/>
										<Input
											required
											placeholder="团队/渠道"
											value={formState.team}
											onChange={(event: ChangeEvent<HTMLInputElement>) =>
												setFormState({ ...formState, team: event.target.value })
											}
										/>
									</div>
									<div className="grid grid-cols-2 gap-3">
										<Input
											type="number"
											min={0}
											placeholder="期望图片量"
											value={formState.expectedImages}
											onChange={(event: ChangeEvent<HTMLInputElement>) =>
												setFormState({
													...formState,
													expectedImages: Number(event.target.value),
												})
											}
										/>
										<Input
											type="number"
											min={0}
											max={100}
											placeholder="AI覆盖目标 %"
											value={formState.aiCoverageTarget}
											onChange={(event: ChangeEvent<HTMLInputElement>) =>
												setFormState({
													...formState,
													aiCoverageTarget: Number(event.target.value),
												})
											}
										/>
									</div>
									<Select
										value={formState.priority}
										onChange={(event: ChangeEvent<HTMLSelectElement>) =>
											setFormState({
												...formState,
												priority: event.target.value,
											})
										}
									>
										<option value="low">低优先级</option>
										<option value="medium">标准</option>
										<option value="high">高优先级</option>
										<option value="urgent">加急</option>
									</Select>
									<Input
										placeholder="标签提示，逗号分隔，例如：电商, 宠物, 室外"
										value={formState.tagHints}
										onChange={(event: ChangeEvent<HTMLInputElement>) =>
											setFormState({
												...formState,
												tagHints: event.target.value,
											})
										}
									/>
									<Button
										type="submit"
										className="w-full"
										disabled={createRequirement.isPending}
									>
										{createRequirement.isPending ? (
											<>
												<Loader2 className="mr-2 size-4 animate-spin" />
												创建中
											</>
										) : (
											<>
												<Plus className="mr-2 size-4" />
												创建需求
											</>
										)}
									</Button>
								</form>
							</CardContent>
						</Card>
					</div>
				</section>

				<section className="grid gap-6 lg:grid-cols-2">
					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<Database className="size-4 text-primary" />
								<div>
									<CardTitle>创建数据集</CardTitle>
									<CardDescription>
										绑定需求即可派发 bucket、覆盖目标与关注标签。
									</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<form className="space-y-3" onSubmit={handleCreateDataset}>
								<Select
									required
									value={datasetForm.requirementId}
									onChange={(event: ChangeEvent<HTMLSelectElement>) =>
										setDatasetForm({
											...datasetForm,
											requirementId: event.target.value,
										})
									}
								>
									<option value="">选择需求</option>
									{requirements.map((requirement) => (
										<option key={requirement.id} value={requirement.id}>
											{requirement.title}
										</option>
									))}
								</Select>
								<Input
									required
									placeholder="数据集名称"
									value={datasetForm.name}
									onChange={(event: ChangeEvent<HTMLInputElement>) =>
										setDatasetForm({ ...datasetForm, name: event.target.value })
									}
								/>
								<Input
									required
									placeholder="存储 Bucket"
									value={datasetForm.storageBucket}
									onChange={(event: ChangeEvent<HTMLInputElement>) =>
										setDatasetForm({
											...datasetForm,
											storageBucket: event.target.value,
										})
									}
								/>
								<div className="grid grid-cols-3 gap-3">
									<Input
										type="number"
										min={0}
										placeholder="总数"
										value={datasetForm.imageCount}
										onChange={(event: ChangeEvent<HTMLInputElement>) =>
											setDatasetForm({
												...datasetForm,
												imageCount: event.target.value,
											})
										}
									/>
									<Input
										type="number"
										min={0}
										placeholder="已处理"
										value={datasetForm.processedCount}
										onChange={(event: ChangeEvent<HTMLInputElement>) =>
											setDatasetForm({
												...datasetForm,
												processedCount: event.target.value,
											})
										}
									/>
									<Input
										type="text"
										placeholder="关注标签：美妆, 室外"
										value={datasetForm.focusTags}
										onChange={(event: ChangeEvent<HTMLInputElement>) =>
											setDatasetForm({
												...datasetForm,
												focusTags: event.target.value,
											})
										}
									/>
								</div>
								<div className="grid grid-cols-3 gap-3">
									<Input
										type="number"
										min={0}
										max={100}
										placeholder="Caption%"
										value={datasetForm.aiCaptionCoverage}
										onChange={(event: ChangeEvent<HTMLInputElement>) =>
											setDatasetForm({
												...datasetForm,
												aiCaptionCoverage: event.target.value,
											})
										}
									/>
									<Input
										type="number"
										min={0}
										max={100}
										placeholder="标签%"
										value={datasetForm.autoTagCoverage}
										onChange={(event: ChangeEvent<HTMLInputElement>) =>
											setDatasetForm({
												...datasetForm,
												autoTagCoverage: event.target.value,
											})
										}
									/>
									<Input
										type="number"
										min={0}
										max={100}
										placeholder="Review%"
										value={datasetForm.reviewCoverage}
										onChange={(event: ChangeEvent<HTMLInputElement>) =>
											setDatasetForm({
												...datasetForm,
												reviewCoverage: event.target.value,
											})
										}
									/>
								</div>
								<Button
									type="submit"
									className="w-full"
									disabled={
										createDataset.isPending || requirements.length === 0
									}
								>
									{createDataset.isPending ? (
										<>
											<Loader2 className="mr-2 size-4 animate-spin" />
											创建中
										</>
									) : (
										<>
											<Plus className="mr-2 size-4" />
											创建数据集
										</>
									)}
								</Button>
							</form>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<ClipboardList className="size-4 text-primary" />
								<div>
									<CardTitle>调度自动化任务</CardTitle>
									<CardDescription>
										关联数据集，即可向后端编排系统发送任务请求。
									</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<form className="space-y-3" onSubmit={handleCreateTask}>
								<Select
									required
									value={taskForm.datasetId}
									onChange={(event: ChangeEvent<HTMLSelectElement>) =>
										setTaskForm({ ...taskForm, datasetId: event.target.value })
									}
								>
									<option value="">选择数据集</option>
									{datasets.map((dataset) => (
										<option key={dataset.id} value={dataset.id}>
											{dataset.name}
										</option>
									))}
								</Select>
								<div className="grid grid-cols-2 gap-3">
									<Select
										value={taskForm.type}
										onChange={(event: ChangeEvent<HTMLSelectElement>) =>
											setTaskForm({ ...taskForm, type: event.target.value })
										}
									>
										{taskTypes.map((type) => (
											<option key={type} value={type}>
												{type.toUpperCase()}
											</option>
										))}
									</Select>
									<Select
										value={taskForm.status}
										onChange={(event: ChangeEvent<HTMLSelectElement>) =>
											setTaskForm({ ...taskForm, status: event.target.value })
										}
									>
										{taskStatusValues.map((status) => (
											<option key={status} value={status}>
												{status.toUpperCase()}
											</option>
										))}
									</Select>
								</div>
								<div className="grid grid-cols-[1fr_auto] gap-3">
									<Input
										type="number"
										min={0}
										max={100}
										placeholder="初始进度 %"
										value={taskForm.progress}
										onChange={(event: ChangeEvent<HTMLInputElement>) =>
											setTaskForm({ ...taskForm, progress: event.target.value })
										}
									/>
									<Input
										placeholder="负责人（可空）"
										value={taskForm.assignedTo}
										onChange={(event: ChangeEvent<HTMLInputElement>) =>
											setTaskForm({
												...taskForm,
												assignedTo: event.target.value,
											})
										}
									/>
								</div>
								<Button
									type="submit"
									className="w-full"
									disabled={createTask.isPending || datasets.length === 0}
								>
									{createTask.isPending ? (
										<>
											<Loader2 className="mr-2 size-4 animate-spin" />
											提交中
										</>
									) : (
										<>
											<Play className="mr-2 size-4" />
											调度任务
										</>
									)}
								</Button>
							</form>
						</CardContent>
					</Card>
				</section>

				<section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
					<Card className="overflow-hidden">
						<CardHeader>
							<CardTitle>自动化任务队列</CardTitle>
							<CardDescription>
								追踪批处理、Caption、标签与质检任务的执行状态。
							</CardDescription>
						</CardHeader>
						<CardContent className="overflow-x-auto">
							<table className="w-full min-w-[640px] text-sm">
								<thead>
									<tr className="text-left text-muted-foreground text-xs">
										<th className="pb-2 font-medium">任务</th>
										<th className="pb-2 font-medium">所属数据集</th>
										<th className="pb-2 font-medium">状态</th>
										<th className="pb-2 text-center font-medium">进度</th>
										<th className="pb-2 text-right font-medium">负责人</th>
									</tr>
								</thead>
								<tbody className="[&_tr]:border-border/60 [&_tr]:border-t">
									{tasks.length === 0 ? (
										<tr>
											<td
												colSpan={5}
												className="py-6 text-center text-muted-foreground"
											>
												暂无任务
											</td>
										</tr>
									) : (
										tasks.slice(0, 6).map((task) => (
											<tr key={task.id} className="text-xs">
												<td className="py-3 font-medium">
													{task.type.toUpperCase()}
												</td>
												<td className="py-3">
													<div className="flex flex-col">
														<span className="font-medium">
															{task.dataset?.name}
														</span>
														<span className="text-muted-foreground">
															{task.requirement?.title ?? "未绑定"}
														</span>
													</div>
												</td>
												<td className="py-3">
													<Select
														value={task.status}
														onChange={(event: ChangeEvent<HTMLSelectElement>) =>
															updateTaskStatus.mutate({
																id: task.id,
																status: event.target
																	.value as (typeof taskStatusValues)[number],
															})
														}
														disabled={updateTaskStatus.isPending}
													>
														{taskStatusValues.map((status) => (
															<option key={status} value={status}>
																{status}
															</option>
														))}
													</Select>
												</td>
												<td className="py-3">
													<Progress value={task.progress} className="h-1.5" />
													<p className="mt-1 text-center text-muted-foreground">
														{task.progress}%
													</p>
												</td>
												<td className="py-3 text-right">
													{task.assignedTo ?? "自动化"}
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<div>
									<CardTitle>标签洞察</CardTitle>
									<CardDescription>
										高频标签覆盖率一览，辅助调度打标任务。
									</CardDescription>
								</div>
								<Tag className="size-4 text-primary" />
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							{tags.length === 0 ? (
								<p className="text-muted-foreground text-sm">暂无标签数据。</p>
							) : (
								tags.slice(0, 6).map((tag) => (
									<div
										key={tag.id}
										className="flex items-center justify-between rounded-xl border bg-card/70 p-3"
									>
										<div>
											<p className="font-medium">{tag.label}</p>
											<p className="text-muted-foreground text-xs">
												{tag.dataset?.name} ·{" "}
												{tag.requirement?.title ?? "未绑定"}
											</p>
										</div>
										<div className="text-right">
											<p className="font-semibold text-sm">{tag.coverage}%</p>
											<p className="text-muted-foreground text-xs">
												{tag.usageCount} 次引用
											</p>
										</div>
									</div>
								))
							)}
						</CardContent>
					</Card>
				</section>

				<section>
					<Card>
						<CardHeader>
							<CardTitle>团队协作概览</CardTitle>
							<CardDescription>
								谁在推动更多任务、哪些看板需要增援。
							</CardDescription>
						</CardHeader>
						<CardContent>
							{ownerSummary.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									暂无成员数据，先创建一个需求吧。
								</p>
							) : (
								<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
									{ownerSummary.map((owner) => (
										<div
											key={owner.owner}
											className="rounded-xl border bg-card/60 p-4 shadow-xs"
										>
											<div className="flex items-center justify-between">
												<div>
													<p className="text-muted-foreground text-sm">
														负责人
													</p>
													<p className="font-semibold text-lg">{owner.owner}</p>
												</div>
												<Badge variant="outline">
													<Users2 className="mr-1 size-3.5" />
													{owner.count}
												</Badge>
											</div>
											<p className="mt-2 text-muted-foreground text-xs">
												当前负责 {owner.count} 个需求
											</p>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
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
	highlight?: string;
};

function SummaryCard({
	label,
	value,
	description,
	icon,
	highlight,
}: SummaryCardProps) {
	return (
		<Card className="bg-card">
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
				<div>
					<p className="text-muted-foreground text-sm">{label}</p>
					<p className="font-semibold text-2xl">{value}</p>
				</div>
				<div className="rounded-full bg-muted/80 p-2">{icon}</div>
			</CardHeader>
			<CardContent>
				<p className="text-muted-foreground text-xs">{description}</p>
				{highlight ? (
					<p className="mt-1 font-medium text-primary text-xs">{highlight}</p>
				) : null}
			</CardContent>
		</Card>
	);
}
