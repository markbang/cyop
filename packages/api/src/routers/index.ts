import { protectedProcedure, publicProcedure, router } from "../index";
import { todoRouter } from "./todo";
import { requirementsRouter } from "./requirements";
import { datasetsRouter } from "./datasets";
import { tasksRouter } from "./tasks";
import { tagsRouter } from "./tags";
import { mediaRouter } from "./media";

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
