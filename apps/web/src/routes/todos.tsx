import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Input,
	Label,
	Textarea,
} from "@cyop/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/todos")({
	component: AiOps,
});

type ModelForm = {
	name: string;
	provider: string;
	modelName: string;
	baseUrl: string;
	apiKeyEnv: string;
	defaultModel: boolean;
};

function AiOps() {
	const [modelForm, setModelForm] = useState<ModelForm>({
		name: "OpenAI GPT-4o-mini",
		provider: "openai-compatible",
		modelName: "gpt-4o-mini",
		baseUrl: "",
		apiKeyEnv: "AI_CAPTION_API_KEY",
		defaultModel: true,
	});
	const [testImageUrl, setTestImageUrl] = useState("");
	const [testPrompt, setTestPrompt] = useState(
		"用简洁中文描述图片，突出主体、场景和动作。",
	);
	const [batchDataset, setBatchDataset] = useState("");
	const [batchModel, setBatchModel] = useState("");
	const [batchLimit, setBatchLimit] = useState(50);
	const [generatedCaption, setGeneratedCaption] = useState("");

	const models = useQuery(trpc.model.list.queryOptions());
	const datasets = useQuery(trpc.dataset.list.queryOptions());
	const jobs = useQuery(
		trpc.captionOps.listJobs.queryOptions(
			batchDataset ? { datasetId: Number(batchDataset) } : undefined,
		),
	);

	const createModel = useMutation(
		trpc.model.create.mutationOptions({
			onSuccess: () => {
				toast.success("模型已保存");
				models.refetch();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const setDefault = useMutation(
		trpc.model.setDefault.mutationOptions({
			onSuccess: () => {
				toast.success("已设为默认模型");
				models.refetch();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const deleteModel = useMutation(
		trpc.model.delete.mutationOptions({
			onSuccess: () => {
				toast.success("模型已删除");
				models.refetch();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const generateCaption = useMutation(
		trpc.captionOps.generate.mutationOptions({
			onSuccess: (result) => {
				toast.success("已生成 Caption");
				setGeneratedCaption(result.caption);
				jobs.refetch();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const enqueueBatch = useMutation(
		trpc.captionOps.enqueueBatch.mutationOptions({
			onSuccess: (res) => {
				const skipText =
					res.skippedMissingUrl > 0
						? `，跳过 ${res.skippedMissingUrl} 条缺少 URL 的素材`
						: "";
				toast.success(`已创建 ${res.count} 条批处理任务${skipText}`);
				jobs.refetch();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const processQueued = useMutation(
		trpc.captionOps.processQueued.mutationOptions({
			onSuccess: (res) => {
				toast.success(
					`队列执行完成：处理 ${res.processed} 条，成功 ${res.succeeded}，失败 ${res.failed}`,
				);
				jobs.refetch();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const selectedModelId = useMemo(() => {
		if (batchModel) {
			return Number(batchModel);
		}
		const defaultModel = models.data?.find((model) => model.defaultModel);
		return defaultModel?.id;
	}, [batchModel, models.data]);

	const handleModelSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		createModel.mutate({
			name: modelForm.name,
			provider: modelForm.provider,
			modelName: modelForm.modelName,
			baseUrl: modelForm.baseUrl || undefined,
			apiKeyEnv: modelForm.apiKeyEnv || undefined,
			defaultModel: modelForm.defaultModel,
			type: "caption",
			enabled: true,
			metadata: {},
		});
	};

	return (
		<div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
			<section className="space-y-2">
				<h1 className="font-semibold text-3xl">AI 模型与 Caption 批处理</h1>
				<p className="text-muted-foreground text-sm">
					管理可用的 Caption 模型、快速测试生成效果，并为素材批量创建 Caption
					任务。
				</p>
			</section>

			<div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
				<Card>
					<CardHeader>
						<CardTitle>模型注册</CardTitle>
						<CardDescription>
							登记 OpenAI 兼容或私有部署的 Caption 模型
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleModelSubmit} className="space-y-3">
							<div className="grid gap-3 md:grid-cols-2">
								<div className="space-y-1.5">
									<Label htmlFor="name">名称</Label>
									<Input
										id="name"
										value={modelForm.name}
										onChange={(event: ChangeEvent<HTMLInputElement>) =>
											setModelForm((prev) => ({
												...prev,
												name: event.target.value,
											}))
										}
										required
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="provider">提供方</Label>
									<Input
										id="provider"
										value={modelForm.provider}
										onChange={(event: ChangeEvent<HTMLInputElement>) =>
											setModelForm((prev) => ({
												...prev,
												provider: event.target.value,
											}))
										}
										required
									/>
								</div>
							</div>
							<div className="grid gap-3 md:grid-cols-2">
								<div className="space-y-1.5">
									<Label htmlFor="modelName">模型 ID</Label>
									<Input
										id="modelName"
										value={modelForm.modelName}
										onChange={(event: ChangeEvent<HTMLInputElement>) =>
											setModelForm((prev) => ({
												...prev,
												modelName: event.target.value,
											}))
										}
										required
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="baseUrl">Base URL (可选)</Label>
									<Input
										id="baseUrl"
										placeholder="https://api.openai.com/v1"
										value={modelForm.baseUrl}
										onChange={(event: ChangeEvent<HTMLInputElement>) =>
											setModelForm((prev) => ({
												...prev,
												baseUrl: event.target.value,
											}))
										}
									/>
								</div>
							</div>
							<div className="grid gap-3 md:grid-cols-2">
								<div className="space-y-1.5">
									<Label htmlFor="apiKeyEnv">API Key 环境变量</Label>
									<Input
										id="apiKeyEnv"
										value={modelForm.apiKeyEnv}
										onChange={(event: ChangeEvent<HTMLInputElement>) =>
											setModelForm((prev) => ({
												...prev,
												apiKeyEnv: event.target.value,
											}))
										}
									/>
								</div>
								<div className="space-y-1.5">
									<Label>默认模型</Label>
									<div className="flex items-center gap-2 rounded-md border px-3 py-2">
										<input
											type="checkbox"
											checked={modelForm.defaultModel}
											onChange={(event: ChangeEvent<HTMLInputElement>) =>
												setModelForm((prev) => ({
													...prev,
													defaultModel: event.target.checked,
												}))
											}
											className="h-4 w-4"
										/>
										<span className="text-muted-foreground text-sm">
											新模型设为默认
										</span>
									</div>
								</div>
							</div>
							<Button type="submit" disabled={createModel.isPending}>
								{createModel.isPending ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<Sparkles className="mr-2 h-4 w-4" />
								)}
								保存模型
							</Button>
						</form>
					</CardContent>
				</Card>

				<Card className="h-full">
					<CardHeader>
						<CardTitle>可用模型</CardTitle>
						<CardDescription>当前注册的 Caption 模型列表</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<Button
							variant="outline"
							size="sm"
							onClick={() => models.refetch()}
							disabled={models.isFetching}
						>
							<RefreshCw
								className={`mr-2 h-4 w-4 ${models.isFetching ? "animate-spin" : ""}`}
							/>
							刷新
						</Button>
						{models.data?.length ? (
							<div className="space-y-3">
								{models.data.map((model) => (
									<div
										key={model.id}
										className="flex items-center justify-between rounded-lg border px-3 py-2"
									>
										<div>
											<div className="flex items-center gap-2">
												<span className="font-medium">{model.name}</span>
												{model.defaultModel ? <Badge>默认</Badge> : null}
												{model.enabled ? (
													<Badge variant="secondary">启用</Badge>
												) : (
													<Badge variant="destructive">停用</Badge>
												)}
											</div>
											<p className="text-muted-foreground text-xs">
												{model.provider} · {model.modelName} ·{" "}
												{model.baseUrl || "系统默认 Base URL"}
											</p>
										</div>
										<div className="flex items-center gap-2">
											<Button
												size="sm"
												variant="outline"
												onClick={() => setDefault.mutate({ id: model.id })}
											>
												设为默认
											</Button>
											<Button
												size="icon"
												variant="ghost"
												onClick={() => deleteModel.mutate({ id: model.id })}
											>
												<Trash2 className="h-4 w-4 text-destructive" />
											</Button>
										</div>
									</div>
								))}
							</div>
						) : (
							<p className="text-muted-foreground text-sm">
								暂无模型，请先注册。
							</p>
						)}
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>快速生成 Caption</CardTitle>
						<CardDescription>输入图片 URL 测试当前模型效果</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<Input
							placeholder="https://example.com/image.jpg"
							value={testImageUrl}
							onChange={(event: ChangeEvent<HTMLInputElement>) =>
								setTestImageUrl(event.target.value)
							}
						/>
						<Textarea
							value={testPrompt}
							onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
								setTestPrompt(event.target.value)
							}
							rows={4}
						/>
						<Button
							disabled={!testImageUrl || generateCaption.isPending}
							onClick={() =>
								generateCaption.mutate({
									imageUrl: testImageUrl,
									prompt: testPrompt,
									modelId: selectedModelId,
								})
							}
						>
							{generateCaption.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Sparkles className="mr-2 h-4 w-4" />
							)}
							生成 Caption
						</Button>
						{generatedCaption ? (
							<div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
								{generatedCaption}
							</div>
						) : null}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>批量任务</CardTitle>
						<CardDescription>为数据集素材创建 Caption 队列</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="space-y-1.5">
							<Label>数据集</Label>
							<select
								className="h-10 w-full rounded-md border px-3 text-sm"
								value={batchDataset}
								onChange={(event: ChangeEvent<HTMLSelectElement>) =>
									setBatchDataset(event.target.value)
								}
							>
								<option value="">选择数据集</option>
								{datasets.data?.map((dataset) => (
									<option key={dataset.id} value={dataset.id}>
										{dataset.name}
									</option>
								))}
							</select>
						</div>
						<div className="space-y-1.5">
							<Label>模型</Label>
							<select
								className="h-10 w-full rounded-md border px-3 text-sm"
								value={batchModel}
								onChange={(event: ChangeEvent<HTMLSelectElement>) =>
									setBatchModel(event.target.value)
								}
							>
								<option value="">默认模型</option>
								{models.data?.map((model) => (
									<option key={model.id} value={model.id}>
										{model.name}
									</option>
								))}
							</select>
						</div>
						<div className="space-y-1.5">
							<Label>批次数量</Label>
							<Input
								type="number"
								min={1}
								max={500}
								value={batchLimit}
								onChange={(event: ChangeEvent<HTMLInputElement>) =>
									setBatchLimit(Number(event.target.value))
								}
							/>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								disabled={!batchDataset || enqueueBatch.isPending}
								onClick={() =>
									enqueueBatch.mutate({
										datasetId: Number(batchDataset),
										modelId: selectedModelId,
										limit: batchLimit,
									})
								}
							>
								{enqueueBatch.isPending ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<Sparkles className="mr-2 h-4 w-4" />
								)}
								创建批处理
							</Button>
							<Button
								variant="outline"
								disabled={processQueued.isPending}
								onClick={() =>
									processQueued.mutate({
										limit: batchLimit > 100 ? 100 : batchLimit,
										modelId: selectedModelId,
									})
								}
							>
								{processQueued.isPending ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<RefreshCw className="mr-2 h-4 w-4" />
								)}
								执行队列
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle>最近 Caption 任务</CardTitle>
						<CardDescription>
							最多显示 200 条，包含模型信息与素材链接
						</CardDescription>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => jobs.refetch()}
						disabled={jobs.isFetching}
					>
						<RefreshCw
							className={`mr-2 h-4 w-4 ${jobs.isFetching ? "animate-spin" : ""}`}
						/>
						刷新
					</Button>
				</CardHeader>
				<CardContent className="space-y-2">
					{jobs.data?.length ? (
						jobs.data.map((job) => (
							<div
								key={job.id}
								className="flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm md:flex-row md:items-center md:justify-between"
							>
								<div>
									<div className="flex items-center gap-2">
										<Badge
											variant={
												job.status === "succeeded" ? "secondary" : "outline"
											}
										>
											{job.status}
										</Badge>
										<span className="font-medium">
											{job.model?.name ?? "默认模型"}
										</span>
									</div>
									<p className="text-muted-foreground">
										{job.dataset?.name ?? "未关联数据集"} ·{" "}
										{job.asset?.originalName ?? "自定义图片"} ·{" "}
										{job.caption?.slice(0, 120) ?? job.error}
									</p>
								</div>
								<div className="text-muted-foreground text-xs">
									{job.completedAt
										? new Date(job.completedAt).toLocaleString()
										: new Date(job.createdAt).toLocaleString()}
								</div>
							</div>
						))
					) : (
						<p className="text-muted-foreground text-sm">暂无任务</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
