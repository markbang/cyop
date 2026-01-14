import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Select,
	Textarea,
} from "@cyop/ui";
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

const statusColors: Record<
	string,
	"default" | "secondary" | "success" | "warning" | "destructive" | "outline"
> = {
	pending: "secondary",
	processing: "default",
	completed: "warning",
	approved: "success",
	rejected: "destructive",
};

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
		<div className="flex h-[calc(100vh-theme(spacing.16))] flex-col bg-muted/10">
			<header className="border-b bg-card/80 px-6 py-4 shadow-sm backdrop-blur-sm">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div>
						<h1 className="font-semibold text-2xl tracking-tight">
							Caption 审核台
						</h1>
						<p className="text-muted-foreground text-sm">
							高效浏览、编辑与验收 AI 生成的图像描述。
						</p>
					</div>

					<div className="flex items-center gap-3">
						<Select
							value={datasetId}
							onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
								setDatasetId(e.target.value)
							}
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
						>
							<option value="">所有状态</option>
							{Object.entries(statusLabels).map(([key, label]) => (
								<option key={key} value={key}>
									{label}
								</option>
							))}
						</Select>

						<div className="h-8 w-px bg-border" />

						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								captionsQuery.refetch();
								statsQuery.refetch();
							}}
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
						>
							<CheckCircle2 className="mr-2 size-4 text-emerald-600" />
							批量通过当前页
						</Button>

						<Button
							size="sm"
							variant="outline"
							onClick={handleBatchRegenerate}
							disabled={
								regenerateMutation.isPending ||
								captions.filter((c) => c.status === "rejected").length === 0
							}
						>
							{regenerateMutation.isPending ? (
								<Loader2 className="mr-2 size-4 animate-spin" />
							) : (
								<RefreshCw className="mr-2 size-4" />
							)}
							重新生成已驳回
						</Button>

						<div className="relative">
							<Select
								value=""
								onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
									const format = e.target.value as "json" | "csv" | "txt";
									if (format) handleExport(format);
								}}
								disabled={isExporting}
							>
								<option value="" disabled>
									{isExporting ? "导出中..." : "导出"}
								</option>
								<option value="json">JSON</option>
								<option value="csv">CSV</option>
								<option value="txt">TXT</option>
							</Select>
							<Download className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						</div>
					</div>
				</div>

				<div className="mt-6 flex gap-6 overflow-x-auto pb-2">
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
					<div className="ml-auto flex items-center gap-2 text-muted-foreground text-sm">
						<span>总计: {statsQuery.data?.total ?? 0}</span>
					</div>
				</div>
			</header>

			<div className="flex flex-1 overflow-hidden">
				<div className="w-80 flex-none overflow-y-auto border-r bg-background/50">
					<div className="p-4">
						<div className="space-y-2">
							{captions.length === 0 ? (
								<div className="py-8 text-center text-muted-foreground text-sm">
									没有找到相关 Caption
								</div>
							) : (
								captions.map((caption) => (
									<button
										type="button"
										key={caption.id}
										onClick={() => setSelectedId(caption.id)}
										className={`group flex w-full cursor-pointer gap-3 rounded-lg border p-3 text-left transition-all hover:bg-accent ${
											selectedId === caption.id
												? "border-primary bg-accent ring-1 ring-primary/20"
												: "border-transparent bg-card"
										}`}
									>
										<div className="relative size-16 flex-none overflow-hidden rounded-md bg-muted">
											{caption.mediaAsset?.publicUrl ? (
												<img
													src={caption.mediaAsset.publicUrl}
													alt=""
													className="size-full object-cover"
													loading="lazy"
												/>
											) : (
												<div className="flex size-full items-center justify-center">
													<ImageIcon className="size-6 text-muted-foreground/50" />
												</div>
											)}
											<div className="absolute top-0 right-0 p-0.5">
												<div
													className={`size-2 rounded-full ${getStatusDotColor(
														caption.status,
													)}`}
												/>
											</div>
										</div>
										<div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
											<div className="flex items-center justify-between gap-2">
												<span className="truncate font-medium text-xs">
													ID: {caption.id}
												</span>
												<span className="text-[10px] text-muted-foreground">
													{new Date(caption.updatedAt).toLocaleDateString()}
												</span>
											</div>
											<p className="line-clamp-2 text-muted-foreground text-xs">
												{caption.manualCaption ||
													caption.aiCaption ||
													"暂无描述..."}
											</p>
										</div>
									</button>
								))
							)}
						</div>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto bg-muted/10 p-6">
					{selectedCaption ? (
						<div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
							<div className="flex flex-col gap-4">
								<Card className="overflow-hidden border-border/50 shadow-sm">
									<div className="aspect-square w-full bg-muted/20 md:aspect-[4/3]">
										{selectedCaption.mediaAsset?.publicUrl ? (
											<img
												src={selectedCaption.mediaAsset.publicUrl}
												alt="Target"
												className="size-full object-contain"
											/>
										) : (
											<div className="flex size-full items-center justify-center text-muted-foreground">
												<ImageIcon className="size-12 opacity-20" />
											</div>
										)}
									</div>
								</Card>

								<Card>
									<CardHeader className="py-4">
										<CardTitle className="text-sm">Metadata</CardTitle>
									</CardHeader>
									<CardContent className="grid grid-cols-2 gap-4 text-xs">
										<div>
											<span className="text-muted-foreground">模型: </span>
											<span className="font-medium">
												{selectedCaption.model ?? "Unknown"}
											</span>
										</div>
										<div>
											<span className="text-muted-foreground">置信度: </span>
											<span className="font-medium">
												{selectedCaption.confidence
													? `${Math.round(selectedCaption.confidence * 100)}%`
													: "N/A"}
											</span>
										</div>
										<div>
											<span className="text-muted-foreground">尺寸: </span>
											<span className="font-medium">
												{selectedCaption.mediaAsset?.width} x{" "}
												{selectedCaption.mediaAsset?.height}
											</span>
										</div>
										<div>
											<span className="text-muted-foreground">Prompt: </span>
											<span
												className="truncate font-medium"
												title={
													selectedCaption.promptTemplate?.userPromptTemplate
												}
											>
												{selectedCaption.promptTemplate?.name ?? "Default"}
											</span>
										</div>
									</CardContent>
								</Card>
							</div>

							<div className="flex flex-col gap-4">
								<Card className="flex flex-1 flex-col border-border/50 shadow-sm">
									<CardHeader className="pb-4">
										<div className="flex items-center justify-between">
											<div>
												<CardTitle>编辑描述</CardTitle>
												<CardDescription>
													AI 生成结果可能需要人工微调
												</CardDescription>
											</div>
											<Badge variant={statusColors[selectedCaption.status]}>
												{statusLabels[selectedCaption.status]}
											</Badge>
										</div>
									</CardHeader>
									<CardContent className="flex flex-1 flex-col gap-4">
										<div className="flex-1">
											<Textarea
												className="min-h-[200px] resize-none text-base leading-relaxed"
												placeholder="输入描述..."
												value={editValue}
												onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
													setEditValue(e.target.value)
												}
											/>
										</div>

										<div className="space-y-4 pt-4">
											<div className="flex items-center gap-2 text-sm">
												<span className="text-muted-foreground">AI 参考:</span>
												<p className="line-clamp-2 flex-1 text-muted-foreground text-xs italic">
													{selectedCaption.aiCaption || "无 AI 生成内容"}
												</p>
											</div>

											<div className="grid grid-cols-2 gap-3">
												<Button
													variant="outline"
													className="w-full justify-start border-destructive/20 text-destructive hover:bg-destructive/10"
													onClick={handleReject}
													disabled={rejectMutation.isPending}
												>
													<ThumbsDown className="mr-2 size-4" />
													驳回
												</Button>
												<Button
													className="w-full justify-start bg-emerald-600 hover:bg-emerald-700"
													onClick={handleApprove}
													disabled={approveMutation.isPending}
												>
													<ThumbsUp className="mr-2 size-4" />
													通过
												</Button>
											</div>
											<Button
												variant="secondary"
												className="w-full"
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
											<Button
												variant="ghost"
												className="w-full"
												onClick={handleRegenerate}
												disabled={regenerateMutation.isPending}
											>
												{regenerateMutation.isPending ? (
													<Loader2 className="mr-2 size-4 animate-spin" />
												) : (
													<RefreshCw className="mr-2 size-4" />
												)}
												重新生成
											</Button>
										</div>
									</CardContent>
								</Card>

								<div className="flex justify-between gap-2">
									<Button
										variant="ghost"
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
										<ChevronLeft className="mr-2 size-4" />
										上一个
									</Button>
									<Button
										variant="ghost"
										onClick={selectNext}
										disabled={
											!selectedId ||
											captions.findIndex((c) => c.id === selectedId) >=
												captions.length - 1
										}
									>
										下一个
										<ChevronRight className="ml-2 size-4" />
									</Button>
								</div>
							</div>
						</div>
					) : (
						<div className="flex h-full flex-col items-center justify-center text-muted-foreground">
							<div className="rounded-full bg-muted p-4">
								<Filter className="size-8 opacity-50" />
							</div>
							<p className="mt-4 font-medium">请选择一个 Caption 开始审核</p>
							<p className="text-sm">从左侧列表中点击任意项目</p>
						</div>
					)}
				</div>
			</div>
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
	return (
		<div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 shadow-sm">
			<div className={`size-2 rounded-full bg-${getTailwindColor(color)}`} />
			<span className="font-medium text-muted-foreground text-xs">{label}</span>
			<span className="font-bold text-xs">{count}</span>
		</div>
	);
}

function getTailwindColor(
	color: "default" | "secondary" | "success" | "warning" | "destructive",
) {
	switch (color) {
		case "success":
			return "emerald-500";
		case "warning":
			return "amber-500";
		case "destructive":
			return "red-500";
		case "secondary":
			return "gray-400";
		default:
			return "blue-500";
	}
}

function getStatusDotColor(status: string) {
	switch (status) {
		case "approved":
			return "bg-emerald-500";
		case "rejected":
			return "bg-red-500";
		case "completed":
			return "bg-amber-500";
		case "processing":
			return "bg-blue-500";
		default:
			return "bg-gray-400";
	}
}
