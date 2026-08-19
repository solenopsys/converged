

export const manifest = {
	name: "hw — операционная система мастерской",
	short_name: "hw",
	description:
		"Заказы, оборудование и переписка с клиентами в одном рабочем пространстве.",
	id: "/",
	start_url: "/",
	scope: "/",
	display: "standalone",
	orientation: "any",
	background_color: "#f7f7f5",
	theme_color: "#f7f7f5",
	lang: "ru",
	dir: "ltr",
	categories: ["business", "productivity"],
	icons: [
		{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
		{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
		{
			src: "/icons/icon-maskable-512.png",
			sizes: "512x512",
			type: "image/png",
			purpose: "maskable",
		},
		{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
	],
} as const;


export const pwaIcons = [
	"icon-192.png",
	"icon-512.png",
	"icon-maskable-512.png",
	"apple-touch-icon.png",
];
