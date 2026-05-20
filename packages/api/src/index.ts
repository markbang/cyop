import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context";

const isProduction =
	(globalThis as { process?: { env?: Record<string, string | undefined> } })
		.process?.env?.NODE_ENV === "production";

export const t = initTRPC.context<Context>().create({
	errorFormatter({ error, shape }) {
		if (error.code === "INTERNAL_SERVER_ERROR" && isProduction) {
			return {
				...shape,
				message: "Internal server error",
				data: undefined,
			};
		}
		return shape;
	},
});

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.session) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Authentication required",
			cause: "No session",
		});
	}
	return next({
		ctx: {
			...ctx,
			session: ctx.session,
		},
	});
});
