// routes.config.ts

const staticRoutes= [
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
	}
];


const dunamicRoutes=[
	{
		path: "/dashboard",
		link:"/modules/panel.js"
	},
	{
		path: "/chats",
		link:"/modules/chats.js"
	},
]


export const routeConfig = [...staticRoutes,...dunamicRoutes.map(item=>({
	...item,
	component: () => import(item.link),
	protected: true,
}))];
