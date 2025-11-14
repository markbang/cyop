import { protectedProcedure, publicProcedure, router } from "../index";
import { datasetsRouter } from "./datasets";
import { mediaRouter } from "./media";
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
});
export type AppRouter = typeof appRouter;
