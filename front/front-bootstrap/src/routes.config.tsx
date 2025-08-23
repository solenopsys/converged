// routes.config.ts

export const staticRoutes= [
	{
		path: "/login",
		component: () => import("../../front-modules/packages/auth/src/Login"),
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
	}
];




