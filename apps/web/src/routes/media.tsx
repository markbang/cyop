import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	CheckCircle2,
	Clipboard,
	Images,
	Loader2,
	Trash2,
	Upload,
} from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type UploadEntry = {
	id: string;
	name: string;
	status: "signing" | "uploading" | "finalizing" | "done" | "error";
	error?: string;
};

export const Route = createFileRoute("/media")({
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
	component: MediaLibrary,
});

function MediaLibrary() {
	const datasetQuery = useQuery(trpc.dataset.list.queryOptions());
	const [filterDataset, setFilterDataset] = useState("");
	const mediaQuery = useQuery(
		trpc.media.list.queryOptions(
			filterDataset ? { datasetId: Number(filterDataset) } : undefined,
		),
	);

	const requestUpload = useMutation(
		trpc.media.requestUpload.mutationOptions({
			onError: (error) => {
				toast.error(error.message);
			},
		}),
	);
	const finalizeUpload = useMutation(
		trpc.media.finalizeUpload.mutationOptions({
			onSuccess: () => {
				mediaQuery.refetch();
			},
			onError: (error) => {
				toast.error(error.message);
			},
		}),
	);
	const deleteMedia = useMutation(
		trpc.media.delete.mutationOptions({
			onSuccess: () => {
				toast.success("素材已删除");
				mediaQuery.refetch();
			},
			onError: (error) => {
				toast.error(error.message);
			},
		}),
	);

	const [selectedDataset, setSelectedDataset] = useState("");
	const [uploads, setUploads] = useState<UploadEntry[]>([]);

	const datasets = datasetQuery.data ?? [];
	const assets = mediaQuery.data ?? [];

	const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
		if (!selectedDataset) {
			toast.error("请先选择一个数据集");
			return;
		}
		const files = event.target.files;
		if (!files?.length) {
			return;
		}
		for (const file of Array.from(files)) {
			await processUpload(file);
		}
		event.target.value = "";
	};

	const processUpload = async (file: File) => {
		const entryId = crypto.randomUUID();
		setUploads((prev) => [
			{
				id: entryId,
				name: file.name,
				status: "signing",
			},
			...prev,
		]);
		try {
			const uploadRequest = await requestUpload.mutateAsync({
				datasetId: Number(selectedDataset),
				fileName: file.name,
				mimeType: file.type,
				size: file.size,
			});
			updateUpload(entryId, "uploading");

			const response = await fetch(uploadRequest.upload.url, {
				method: "PUT",
				headers: uploadRequest.upload.headers,
				body: file,
			});
			if (!response.ok) {
				throw new Error("上传失败，请稍后重试");
			}

			updateUpload(entryId, "finalizing");

			const dimensions = await readImageDimensions(file);

			await finalizeUpload.mutateAsync({
				assetId: uploadRequest.asset.id,
				size: file.size,
				width: dimensions?.width,
				height: dimensions?.height,
				status: "uploaded",
			});

			updateUpload(entryId, "done");
			toast.success(`${file.name} 上传完成`);
		} catch (error) {
			console.error(error);
			updateUpload(entryId, "error", error instanceof Error ? error.message : "上传失败");
			toast.error(`${file.name} 上传失败`);
		}
	};

	const updateUpload = (id: string, status: UploadEntry["status"], error?: string) => {
		setUploads((prev) =>
			prev.map((upload) =>
				upload.id === id
					? {
							...upload,
							status,
							error,
						}
					: upload,
			),
		);
	};

	const handleDelete = (assetId: number, name: string) => {
		if (!window.confirm(`确定删除素材「${name}」吗？`)) {
			return;
		}
		deleteMedia.mutate({ assetId, removeFromStorage: true });
	};

	const isUploading = requestUpload.isPending || finalizeUpload.isPending;

	return (
		<div className="h-full overflow-y-auto bg-muted/10">
			<div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
				<section className="space-y-3">
					<h1 className="text-3xl font-semibold tracking-tight">素材库 & 上传</h1>
					<p className="max-w-2xl text-sm text-muted-foreground">
						支持直接上传到 S3 兼容存储，自动记录素材与所属数据集，并提供预览与链接复制。
					</p>
				</section>

				<section className="grid gap-4 md:grid-cols-[2fr_1fr]">
					<Card className="border-dashed">
						<CardHeader>
							<CardTitle>上传素材</CardTitle>
							<CardDescription>
								选择目标数据集后将文件拖拽或点击上传，系统会自动生成 S3 签名并追踪状态。
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid gap-3 sm:grid-cols-[250px_1fr]">
								<Select
									value={selectedDataset}
									onChange={(event) => setSelectedDataset(event.target.value)}
								>
									<option value="">选择数据集</option>
									{datasets.map((dataset) => (
										<option key={dataset.id} value={dataset.id}>
											{dataset.name}
										</option>
									))}
								</Select>
								<Input
									disabled
									value={
										selectedDataset
											? datasets.find((dataset) => dataset.id === Number(selectedDataset))
													?.requirement?.title ?? "未关联需求"
											: "选择数据集后显示需求信息"
									}
								/>
							</div>
							<label
								className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border/70 bg-background text-center transition hover:border-primary"
							>
								<Upload className="size-10 text-muted-foreground" />
								<div>
									<p className="text-lg font-medium">拖拽文件到此处</p>
									<p className="text-sm text-muted-foreground">
										支持图片、视频等常见素材，单次可多选上传
									</p>
								</div>
								<input
									type="file"
									multiple
									className="hidden"
									onChange={handleFileChange}
									disabled={!selectedDataset || isUploading}
								/>
								<Button type="button" disabled={!selectedDataset || isUploading}>
									选择文件
								</Button>
							</label>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>上传队列</CardTitle>
							<CardDescription>实时查看签名、上传与入库状态</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							{uploads.length === 0 ? (
								<p className="text-sm text-muted-foreground">尚无上传任务</p>
							) : (
								uploads.slice(0, 5).map((upload) => (
									<div
										key={upload.id}
										className="rounded-lg border bg-card/80 px-3 py-2 text-sm"
									>
										<p className="font-medium">{upload.name}</p>
										<p className="text-xs text-muted-foreground">
											{statusLabel(upload.status)}
										</p>
										{upload.error ? (
											<p className="text-xs text-destructive">{upload.error}</p>
										) : null}
									</div>
								))
							)}
						</CardContent>
					</Card>
				</section>

				<section className="space-y-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<h2 className="text-xl font-semibold">素材列表</h2>
							<p className="text-sm text-muted-foreground">
								最近上传的素材会显示在此，包含预览、所属数据集与链接复制能力。
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Select
								value={filterDataset}
								onChange={(event) => setFilterDataset(event.target.value)}
								className="w-48"
							>
								<option value="">全部数据集</option>
								{datasets.map((dataset) => (
									<option key={dataset.id} value={dataset.id}>
										{dataset.name}
									</option>
								))}
							</Select>
							<Button variant="outline" onClick={() => mediaQuery.refetch()}>
								<Loader2
									className={`mr-2 size-4 ${mediaQuery.isRefetching ? "animate-spin" : ""}`}
								/>
								刷新
							</Button>
						</div>
					</div>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{assets.length === 0 ? (
							<Card className="sm:col-span-2 lg:col-span-3">
								<CardContent className="py-12 text-center text-muted-foreground">
									暂无素材，先上传一个文件吧。
								</CardContent>
							</Card>
						) : (
							assets.map((asset) => (
								<Card key={asset.id} className="overflow-hidden">
									<div className="relative h-48 w-full bg-muted">
										{asset.publicUrl && asset.mimeType.startsWith("image/") ? (
											<img
												src={asset.publicUrl}
												alt={asset.originalName}
												className="h-full w-full object-cover"
											/>
										) : (
											<div className="flex h-full w-full items-center justify-center text-muted-foreground">
												<Images className="size-8" />
											</div>
										)}
										<div className="absolute right-3 top-3">
											<Badge variant="secondary">{asset.status}</Badge>
										</div>
									</div>
									<CardContent className="space-y-2 py-4 text-sm">
										<div className="flex items-center justify-between">
											<p className="font-medium" title={asset.originalName}>
												{asset.originalName}
											</p>
											<span className="text-xs text-muted-foreground">
												{formatBytes(asset.size)}
											</span>
										</div>
										<p className="text-xs text-muted-foreground">
											{asset.dataset?.name ?? "未关联数据集"}
										</p>
										<div className="flex items-center gap-2 text-xs text-muted-foreground">
											{asset.width && asset.height ? (
												<span>
													{asset.width} × {asset.height}
												</span>
											) : null}
											<span>·</span>
											<span>{asset.mimeType}</span>
										</div>
										<div className="grid grid-cols-2 gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => copyLink(asset.publicUrl)}
												disabled={!asset.publicUrl}
											>
												<Clipboard className="mr-2 size-4" />
												复制链接
											</Button>
											<Button
												variant="destructive"
												size="sm"
												onClick={() => handleDelete(asset.id, asset.originalName)}
												disabled={deleteMedia.isPending}
											>
												<Trash2 className="mr-2 size-4" />
												删除
											</Button>
										</div>
									</CardContent>
								</Card>
							))
						)}
					</div>
				</section>
			</div>
		</div>
	);
}

const statusCopy: Record<UploadEntry["status"], string> = {
	signing: "生成上传签名",
	uploading: "上传中",
	finalizing: "写入素材库",
	done: "完成",
	error: "失败",
};

function statusLabel(status: UploadEntry["status"]) {
	return status === "done" ? (
		<span className="inline-flex items-center gap-1 text-emerald-500">
			<CheckCircle2 className="size-3.5" />
			{statusCopy[status]}
		</span>
	) : (
		statusCopy[status]
	);
}

function formatBytes(bytes?: number | null) {
	if (!bytes) {
		return "0 B";
	}
	const units = ["B", "KB", "MB", "GB"];
	let size = bytes;
	let unit = 0;
	while (size >= 1024 && unit < units.length - 1) {
		size /= 1024;
		unit += 1;
	}
	return `${size.toFixed(1)} ${units[unit]}`;
}

async function readImageDimensions(file: File) {
	if (!file.type.startsWith("image/")) {
		return undefined;
	}
	return await new Promise<{ width: number; height: number } | undefined>((resolve) => {
		const image = new Image();
		const url = URL.createObjectURL(file);
		image.onload = () => {
			resolve({
				width: image.width,
				height: image.height,
			});
			URL.revokeObjectURL(url);
		};
		image.onerror = () => {
			resolve(undefined);
			URL.revokeObjectURL(url);
		};
		image.src = url;
	});
}

async function copyLink(url?: string | null) {
	if (!url) {
		return;
	}
	try {
		await navigator.clipboard.writeText(url);
		toast.success("链接已复制");
	} catch (error) {
		console.error(error);
		toast.error("复制失败，请手动复制");
	}
}
