const env = ((
	globalThis as { process?: { env?: Record<string, string | undefined> } }
).process?.env ?? {}) as Record<string, string | undefined>;

type DatasetCreatedPayload = {
	type: "dataset.created";
	datasetId: number;
	requirementId: number;
	focusTags: string[];
	targetCoverage: {
		caption: number;
		tag: number;
	};
};

type DatasetMetricsPayload = {
	type: "dataset.metrics_updated";
	datasetId: number;
	imageCount: number;
	processedCount: number;
	pendingCount: number;
	coverage: {
		caption: number;
		tag: number;
		review: number;
	};
};

type TaskCreatedPayload = {
	type: "task.created";
	taskId: number;
	datasetId: number;
	taskType: string;
	status: string;
	assignedTo?: string | null;
};

type TaskUpdatedPayload = {
	type: "task.updated";
	taskId: number;
	datasetId: number;
	status: string;
	progress: number;
	failureReason?: string | null;
};

type AutomationEventPayload =
	| DatasetCreatedPayload
	| DatasetMetricsPayload
	| TaskCreatedPayload
	| TaskUpdatedPayload;

type BaseAutomationEvent = {
	source: "cyop-control-tower";
	emittedAt: string;
};

type AutomationEvent = AutomationEventPayload & BaseAutomationEvent;

export async function publishAutomationEvent(event: AutomationEventPayload) {
	const endpoint = env.AUTOMATION_WEBHOOK_URL;

	if (!endpoint) {
		return;
	}

	const payload: AutomationEvent = {
		...event,
		emittedAt: new Date().toISOString(),
		source: "cyop-control-tower",
	};

	try {
		await fetch(endpoint, {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify(payload),
		});
	} catch (error) {
		console.error("Failed to publish automation event", error);
	}
}
