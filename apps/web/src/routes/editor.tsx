import { Badge, Button, Select, Textarea } from "@cyop/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import {
	Check,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Download,
	Filter,
	Image as ImageIcon,
	Loader2,
	RefreshCw,
	RotateCcw,
	ThumbsDown,
	ThumbsUp,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { trpc, trpcClient } from "@/utils/trpc";

export const Route = createFileRoute("/editor")({
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
	component: EditorView,
});

const statusLabels: Record<string, string> = {
	pending: "待处理",
	processing: "生成中",
	completed: "待审核",
	approved: "已通过",
	rejected: "已驳回",
};

function EditorView() {
	const [datasetId, setDatasetId] = useState<string>("");
	const [statusFilter, setStatusFilter] = useState<string>("");
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [editValue, setEditValue] = useState("");

	const datasetsQuery = useQuery(trpc.dataset.list.queryOptions());
	const statsQuery = useQuery(
		trpc.caption.stats.queryOptions({
			datasetId: datasetId ? Number(datasetId) : undefined,
		}),
	);

	const captionsQuery = useQuery(
		trpc.caption.list.queryOptions({
			datasetId: datasetId ? Number(datasetId) : undefined,
			status: statusFilter
				? (statusFilter as
						| "pending"
						| "processing"
						| "completed"
						| "approved"
						| "rejected")
				: undefined,
			limit: 50,
		}),
	);

	const updateMutation = useMutation(
		trpc.caption.update.mutationOptions({
			onSuccess: () => {
				captionsQuery.refetch();
				statsQuery.refetch();
			},
		}),
	);

	const approveMutation = useMutation(
		trpc.caption.approve.mutationOptions({
			onSuccess: () => {
				captionsQuery.refetch();
				statsQuery.refetch();
				selectNext();
			},
		}),
	);

	const rejectMutation = useMutation(
		trpc.caption.reject.mutationOptions({
			onSuccess: () => {
				captionsQuery.refetch();
				statsQuery.refetch();
				selectNext();
			},
		}),
	);

	const batchApproveMutation = useMutation(
		trpc.caption.batchApprove.mutationOptions({
			onSuccess: () => {
				captionsQuery.refetch();
				statsQuery.refetch();
			},
		}),
	);

	const regenerateMutation = useMutation(
		trpc.caption.regenerate.mutationOptions({
			onSuccess: () => {
				captionsQuery.refetch();
				statsQuery.refetch();
			},
		}),
	);

	const [isExporting, setIsExporting] = useState(false);

	const handleExport = async (format: "json" | "csv" | "txt") => {
		setIsExporting(true);
		try {
			const result = await trpcClient.caption.export.query({
				datasetId: datasetId ? Number(datasetId) : undefined,
				format,
				statusFilter: statusFilter
					? (statusFilter as
							| "pending"
							| "processing"
							| "completed"
							| "approved"
							| "rejected")
					: undefined,
			});

			let blob: Blob;
			let filename: string;

			if ("files" in result) {
				const combinedContent = result.files
					.map((f) => `--- ${f.filename} ---\n${f.content}`)
					.join("\n\n");
				blob = new Blob([combinedContent], { type: "text/plain" });
				filename = `captions_${Date.now()}.txt`;
			} else if (typeof result.data === "string") {
				blob = new Blob([result.data], { type: "text/csv" });
				filename = `captions_${Date.now()}.csv`;
			} else {
				blob = new Blob([JSON.stringify(result.data, null, 2)], {
					type: "application/json",
				});
				filename = `captions_${Date.now()}.json`;
			}

			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error("Export failed:", err);
		} finally {
			setIsExporting(false);
		}
	};

	const handleRegenerate = () => {
		if (!selectedId) return;
		regenerateMutation.mutate({ ids: [selectedId] });
	};

	const handleBatchRegenerate = () => {
		const rejectedIds = captions
			.filter((c) => c.status === "rejected")
			.map((c) => c.id);
		if (rejectedIds.length === 0) return;
		regenerateMutation.mutate({ ids: rejectedIds });
	};

	const captions = captionsQuery.data ?? [];
	const selectedCaption = useMemo(
		() => captions.find((c) => c.id === selectedId),
		[captions, selectedId],
	);

	useEffect(() => {
		if (selectedCaption) {
			setEditValue(
				selectedCaption.manualCaption || selectedCaption.aiCaption || "",
			);
		}
	}, [selectedCaption]);

	const selectNext = () => {
		if (!selectedId || captions.length === 0) return;
		const currentIndex = captions.findIndex((c) => c.id === selectedId);
		if (currentIndex < captions.length - 1) {
			setSelectedId(captions[currentIndex + 1].id);
		} else if (captions.length > 0) {
			setSelectedId(captions[0].id);
		} else {
			setSelectedId(null);
		}
	};

	const handleSave = () => {
		if (!selectedId) return;
		updateMutation.mutate({
			id: selectedId,
			manualCaption: editValue,
			finalCaption: editValue,
		});
	};

	const handleApprove = () => {
		if (!selectedId) return;
		approveMutation.mutate({ id: selectedId });
	};

	const handleReject = () => {
		if (!selectedId) return;
		rejectMutation.mutate({ id: selectedId, reason: "Manual rejection" });
	};

	const handleBatchApprove = () => {
		const pendingIds = captions
			.filter((c) => c.status === "completed" || c.status === "pending")
			.map((c) => c.id);
		if (pendingIds.length === 0) return;
		batchApproveMutation.mutate({ ids: pendingIds });
	};

	return (
		<div className="flex h-screen w-full flex-col bg-slate-50 font-sans text-slate-800 dark:bg-slate-950 dark:text-slate-200">
			<header className="sticky top-4 z-50 mx-4 mb-4 rounded-2xl border border-slate-200 bg-white/90 px-6 py-4 shadow-sm backdrop-blur-xl transition-all dark:border-slate-800 dark:bg-slate-900/90">
				<div className="flex flex-wrap items-center justify-between gap-6">
					<div className="flex flex-col gap-1">
						<h1 className="font-semibold text-2xl text-slate-900 tracking-tight dark:text-slate-50">
							Caption 审核台
						</h1>
						<p className="text-slate-500 text-sm dark:text-slate-400">
							高效浏览、编辑与验收 AI 生成的图像描述
						</p>
					</div>

					<div className="flex flex-1 items-center justify-end gap-3">
						<div className="flex items-center gap-2">
							<Select
								value={datasetId}
								onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
									setDatasetId(e.target.value)
								}
								className="h-9 w-[180px] border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-blue-900"
							>
								<option value="">所有数据集</option>
								{datasetsQuery.data?.map((ds) => (
									<option key={ds.id} value={ds.id}>
										{ds.name}
									</option>
								))}
							</Select>

							<Select
								value={statusFilter}
								onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
									setStatusFilter(e.target.value)
								}
								className="h-9 w-[140px] border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-blue-900"
							>
								<option value="">所有状态</option>
								{Object.entries(statusLabels).map(([key, label]) => (
									<option key={key} value={key}>
										{label}
									</option>
								))}
							</Select>
						</div>

						<div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />

						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									captionsQuery.refetch();
									statsQuery.refetch();
								}}
								className="h-9 border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
							>
								{captionsQuery.isFetching ? (
									<Loader2 className="mr-2 size-4 animate-spin" />
								) : (
									<RotateCcw className="mr-2 size-4" />
								)}
								刷新
							</Button>

							<Button
								size="sm"
								variant="secondary"
								onClick={handleBatchApprove}
								disabled={batchApproveMutation.isPending}
								className="h-9 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
							>
								<CheckCircle2 className="mr-2 size-4 text-blue-600 dark:text-blue-400" />
								批量通过
							</Button>

							<Button
								size="sm"
								variant="outline"
								onClick={handleBatchRegenerate}
								disabled={
									regenerateMutation.isPending ||
									captions.filter((c) => c.status === "rejected").length === 0
								}
								className="h-9 border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
							>
								{regenerateMutation.isPending ? (
									<Loader2 className="mr-2 size-4 animate-spin" />
								) : (
									<RefreshCw className="mr-2 size-4" />
								)}
								重试驳回
							</Button>

							<div className="relative">
								<Select
									value=""
									onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
										const format = e.target.value as "json" | "csv" | "txt";
										if (format) handleExport(format);
									}}
									disabled={isExporting}
									className="h-9 w-[100px] border-slate-200 bg-white pl-9 text-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
								>
									<option value="" disabled>
										{isExporting ? "..." : "导出"}
									</option>
									<option value="json">JSON</option>
									<option value="csv">CSV</option>
									<option value="txt">TXT</option>
								</Select>
								<Download className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
							</div>
						</div>
					</div>
				</div>

				<div className="mt-6 flex items-center gap-4 border-slate-100 border-t pt-4 dark:border-slate-800">
					<StatBadge
						label="待审核"
						count={statsQuery.data?.completed ?? 0}
						color="warning"
					/>
					<StatBadge
						label="已通过"
						count={statsQuery.data?.approved ?? 0}
						color="success"
					/>
					<StatBadge
						label="已驳回"
						count={statsQuery.data?.rejected ?? 0}
						color="destructive"
					/>
					<StatBadge
						label="处理中"
						count={statsQuery.data?.processing ?? 0}
						color="default"
					/>
					<div className="ml-auto flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600 text-xs dark:bg-slate-800 dark:text-slate-400">
						<span>总计: {statsQuery.data?.total ?? 0}</span>
					</div>
				</div>
			</header>

			<main className="flex flex-1 gap-6 overflow-hidden px-4 pb-4">
				<aside className="flex w-80 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
					<div className="flex-1 overflow-y-auto p-3">
						<div className="space-y-2">
							{captions.length === 0 ? (
								<div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-600">
									<Filter className="size-8 opacity-20" />
									<span className="text-sm">没有找到相关条目</span>
								</div>
							) : (
								captions.map((caption) => (
									<button
										type="button"
										key={caption.id}
										onClick={() => setSelectedId(caption.id)}
										className={`group relative flex w-full cursor-pointer gap-3 rounded-xl border p-3 text-left transition-all duration-200 ${
											selectedId === caption.id
												? "border-blue-200 bg-blue-50/50 shadow-sm ring-1 ring-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:ring-blue-900/30"
												: "border-transparent hover:border-slate-100 hover:bg-slate-50 dark:hover:border-slate-800 dark:hover:bg-slate-800/50"
										}`}
									>
										<div className="relative size-16 flex-none overflow-hidden rounded-lg border border-slate-100 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
											{caption.mediaAsset?.publicUrl ? (
												<img
													src={caption.mediaAsset.publicUrl}
													alt=""
													className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
													loading="lazy"
												/>
											) : (
												<div className="flex size-full items-center justify-center">
													<ImageIcon className="size-6 text-slate-300 dark:text-slate-600" />
												</div>
											)}
										</div>
										<div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
											<div className="flex items-center justify-between gap-2">
												<span className="font-semibold text-slate-700 text-xs dark:text-slate-300">
													#{caption.id}
												</span>
												<div
													className={`size-2 rounded-full ${getStatusDotColor(
														caption.status,
													)}`}
												/>
											</div>
											<p className="line-clamp-2 text-slate-500 text-xs leading-relaxed dark:text-slate-400">
												{caption.manualCaption ||
													caption.aiCaption ||
													"暂无描述..."}
											</p>
											<span className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
												{new Date(caption.updatedAt).toLocaleDateString()}
											</span>
										</div>
									</button>
								))
							)}
						</div>
					</div>
				</aside>

				<section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
					{selectedCaption ? (
						<div className="flex h-full flex-col lg:flex-row">
							<div className="flex flex-1 flex-col border-slate-100 border-b bg-slate-50/50 lg:w-1/2 lg:border-r lg:border-b-0 dark:border-slate-800 dark:bg-slate-950/50">
								<div className="flex flex-1 items-center justify-center p-6">
									<div className="relative flex size-full items-center justify-center">
										{selectedCaption.mediaAsset?.publicUrl ? (
											<img
												src={selectedCaption.mediaAsset.publicUrl}
												alt="Target"
												className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
											/>
										) : (
											<div className="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-600">
												<ImageIcon className="size-16 opacity-20" />
												<span className="text-sm">无法加载预览图</span>
											</div>
										)}
									</div>
								</div>

								<div className="border-slate-200 border-t bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
									<h3 className="mb-4 font-semibold text-slate-900 text-sm dark:text-slate-100">
										Metadata
									</h3>
									<div className="grid grid-cols-2 gap-x-8 gap-y-4 text-xs">
										<div className="flex justify-between border-slate-50 border-b pb-2 dark:border-slate-800">
											<span className="text-slate-500 dark:text-slate-400">
												模型
											</span>
											<span className="font-medium text-slate-700 dark:text-slate-300">
												{selectedCaption.model ?? "Unknown"}
											</span>
										</div>
										<div className="flex justify-between border-slate-50 border-b pb-2 dark:border-slate-800">
											<span className="text-slate-500 dark:text-slate-400">
												置信度
											</span>
											<span className="font-medium text-slate-700 dark:text-slate-300">
												{selectedCaption.confidence
													? `${Math.round(selectedCaption.confidence * 100)}%`
													: "N/A"}
											</span>
										</div>
										<div className="flex justify-between border-slate-50 border-b pb-2 dark:border-slate-800">
											<span className="text-slate-500 dark:text-slate-400">
												尺寸
											</span>
											<span className="font-medium text-slate-700 dark:text-slate-300">
												{selectedCaption.mediaAsset?.width} x{" "}
												{selectedCaption.mediaAsset?.height}
											</span>
										</div>
										<div className="flex justify-between border-slate-50 border-b pb-2 dark:border-slate-800">
											<span className="text-slate-500 dark:text-slate-400">
												Prompt
											</span>
											<span
												className="max-w-[120px] truncate font-medium text-slate-700 dark:text-slate-300"
												title={
													selectedCaption.promptTemplate?.userPromptTemplate
												}
											>
												{selectedCaption.promptTemplate?.name ?? "Default"}
											</span>
										</div>
									</div>
								</div>
							</div>

							<div className="flex flex-1 flex-col bg-white lg:w-1/2 dark:bg-slate-900">
								<div className="flex items-center justify-between border-slate-100 border-b px-6 py-4 dark:border-slate-800">
									<div>
										<h2 className="font-semibold text-lg text-slate-900 dark:text-slate-50">
											编辑描述
										</h2>
										<p className="text-slate-500 text-xs dark:text-slate-400">
											AI 生成结果可能需要人工微调
										</p>
									</div>
									<Badge
										className={`px-3 py-1 font-medium ${getStatusBadgeStyle(
											selectedCaption.status,
										)}`}
									>
										{statusLabels[selectedCaption.status]}
									</Badge>
								</div>

								<div className="flex flex-1 flex-col gap-4 p-6">
									<div className="relative flex-1">
										<Textarea
											className="h-full w-full resize-none border-slate-200 bg-slate-50 p-4 text-base text-slate-800 leading-relaxed placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-blue-500/30 dark:placeholder:text-slate-600"
											placeholder="请输入图片描述..."
											value={editValue}
											onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
												setEditValue(e.target.value)
											}
										/>
									</div>

									<div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
										<div className="mb-2 flex items-center gap-2">
											<span className="font-semibold text-slate-500 text-xs uppercase tracking-wider dark:text-slate-400">
												AI 参考
											</span>
										</div>
										<p className="text-slate-600 text-xs italic leading-relaxed dark:text-slate-400">
											{selectedCaption.aiCaption || "无 AI 生成内容"}
										</p>
									</div>
								</div>

								<div className="border-slate-100 border-t bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/50">
									<div className="flex flex-col gap-4">
										<div className="grid grid-cols-2 gap-4">
											<Button
												variant="outline"
												className="h-10 border-red-200 text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-900/20"
												onClick={handleReject}
												disabled={rejectMutation.isPending}
											>
												<ThumbsDown className="mr-2 size-4" />
												驳回
											</Button>
											<Button
												className="h-10 bg-emerald-600 text-white shadow-emerald-600/20 shadow-sm transition-all hover:bg-emerald-700 hover:shadow-emerald-600/30 dark:bg-emerald-600 dark:hover:bg-emerald-500"
												onClick={handleApprove}
												disabled={approveMutation.isPending}
											>
												<ThumbsUp className="mr-2 size-4" />
												通过
											</Button>
										</div>

										<Button
											variant="secondary"
											className="h-10 w-full bg-blue-600 text-white shadow-blue-600/20 shadow-sm hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
											onClick={handleSave}
											disabled={updateMutation.isPending}
										>
											{updateMutation.isPending ? (
												<Loader2 className="mr-2 size-4 animate-spin" />
											) : (
												<Check className="mr-2 size-4" />
											)}
											保存修改
										</Button>

										<div className="flex items-center justify-between gap-4 pt-2">
											<Button
												variant="ghost"
												size="sm"
												className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
												onClick={handleRegenerate}
												disabled={regenerateMutation.isPending}
											>
												<RefreshCw
													className={`mr-2 size-3 ${regenerateMutation.isPending ? "animate-spin" : ""}`}
												/>
												重新生成
											</Button>

											<div className="flex items-center gap-2">
												<Button
													variant="ghost"
													size="icon"
													className="size-8 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
													onClick={() => {
														const currentIndex = captions.findIndex(
															(c) => c.id === selectedId,
														);
														if (currentIndex > 0) {
															setSelectedId(captions[currentIndex - 1].id);
														}
													}}
													disabled={
														!selectedId ||
														captions.findIndex((c) => c.id === selectedId) <= 0
													}
												>
													<ChevronLeft className="size-4" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													className="size-8 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
													onClick={selectNext}
													disabled={
														!selectedId ||
														captions.findIndex((c) => c.id === selectedId) >=
															captions.length - 1
													}
												>
													<ChevronRight className="size-4" />
												</Button>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					) : (
						<div className="flex h-full flex-col items-center justify-center bg-slate-50/50 text-slate-400 dark:bg-slate-950/50 dark:text-slate-600">
							<div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
								<Filter className="size-10 text-slate-300 dark:text-slate-700" />
							</div>
							<h3 className="mt-6 font-semibold text-slate-700 dark:text-slate-300">
								请选择一个 Caption
							</h3>
							<p className="mt-2 text-slate-500 text-sm dark:text-slate-400">
								从左侧列表中点击任意项目开始审核
							</p>
						</div>
					)}
				</section>
			</main>
		</div>
	);
}

function StatBadge({
	label,
	count,
	color,
}: {
	label: string;
	count: number;
	color: "default" | "secondary" | "success" | "warning" | "destructive";
}) {
	const colorClasses = {
		default:
			"bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
		secondary:
			"bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
		success:
			"bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
		warning:
			"bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
		destructive:
			"bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
	};

	return (
		<div
			className={`flex items-center gap-2 rounded-full border px-3 py-1 font-medium text-xs transition-colors ${colorClasses[color]}`}
		>
			<span>{label}</span>
			<span className="font-bold opacity-80">{count}</span>
		</div>
	);
}

function getStatusDotColor(status: string) {
	switch (status) {
		case "approved":
			return "bg-emerald-500 dark:bg-emerald-400";
		case "rejected":
			return "bg-red-500 dark:bg-red-400";
		case "completed":
			return "bg-amber-500 dark:bg-amber-400";
		case "processing":
			return "bg-blue-500 dark:bg-blue-400";
		default:
			return "bg-slate-300 dark:bg-slate-600";
	}
}

function getStatusBadgeStyle(status: string) {
	switch (status) {
		case "approved":
			return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-transparent dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40";
		case "rejected":
			return "bg-red-100 text-red-700 hover:bg-red-100 border-transparent dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/40";
		case "completed":
			return "bg-amber-100 text-amber-700 hover:bg-amber-100 border-transparent dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/40";
		case "processing":
			return "bg-blue-100 text-blue-700 hover:bg-blue-100 border-transparent dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/40";
		default:
			return "bg-slate-100 text-slate-700 hover:bg-slate-100 border-transparent dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/80";
	}
}
