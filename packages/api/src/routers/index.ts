import { protectedProcedure, publicProcedure, router } from "../index";
import { captionRouter } from "./caption";
import { captionsRouter } from "./captions";
import { datasetsRouter } from "./datasets";
import { mediaRouter } from "./media";
import { modelsRouter } from "./models";
import { promptsRouter } from "./prompts";
import { requirementsRouter } from "./requirements";
import { tagsRouter } from "./tags";
import { tasksRouter } from "./tasks";
import { todoRouter } from "./todo";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	privateData: protectedProcedure.query(({ ctx }) => {
		return {
			message: "This is private",
			user: ctx.session.user,
		};
	}),
	todo: todoRouter,
	requirement: requirementsRouter,
	dataset: datasetsRouter,
	task: tasksRouter,
	tag: tagsRouter,
	media: mediaRouter,
	caption: captionsRouter,
	captionOps: captionRouter,
	prompt: promptsRouter,
	model: modelsRouter,
});
export type AppRouter = typeof appRouter;
