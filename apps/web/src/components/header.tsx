import { Link } from "@tanstack/react-router";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
	const links = [
		{ to: "/", label: "概览" },
		{ to: "/dashboard", label: "控制塔" },
		{ to: "/media", label: "素材库" },
		{ to: "/todos", label: "示例 API" },
	] as const;

	return (
		<header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
				<nav className="flex items-center gap-4 text-muted-foreground text-sm">
					{links.map(({ to, label }) => (
						<Link
							key={to}
							to={to}
							activeProps={{
								className: "text-foreground font-semibold",
							}}
							className="transition hover:text-foreground"
						>
							{label}
						</Link>
					))}
				</nav>
				<div className="flex items-center gap-2">
					<ModeToggle />
					<UserMenu />
				</div>
			</div>
		</header>
	);
}
