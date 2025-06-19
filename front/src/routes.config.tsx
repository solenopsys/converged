// routes.config.ts
export const routeConfig = [
	{
		path: "/login",
		component: () => import("./Login"),
		protected: false,
	},
	{
		path: "/auth/callback/:provider",
		element: (
			<div className="flex h-screen flex-col items-center justify-center p-4">
				<div className="mb-4 text-xl">Completing authentication...</div>
			</div>
		),
		protected: false,
	},
	{
		path: "/dashboard",
		component: () => import("./modules/Panel"),
		protected: true,
	},	{
		path: "/chats",
		component: () => import("./modules/Chats"),
		protected: true,
	},
];
