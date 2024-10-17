const hendlers: { [key: string]: HendlerFunc } = {};
import { join } from "path";

const rootDir = "../distp/bs-solenopsys";

interface HendlerFunc {
	(req: { path: string }): Promise<Response>;
}

hendlers["*/"] = async (req: { path: string }) => {
	const htmlContent: string = await Bun.file(
		join(rootDir, "/index.html"),
	).text();

	return new Response(htmlContent, {
		headers: {
			"Content-Type": "text/html",
		},
	});
};

Bun.serve({
	port: 8080,
	async fetch(request) {
		const url = new URL(request.url);
		const path = url.pathname + url.search;

		const handlerKey: string | undefined = Object.keys(hendlers).find(
			(item) => {
				const pattern = "^" + item.replace("*", ".*") + "$";
				return path.match(pattern);
			},
		);

		if (handlerKey) {
			const h: HendlerFunc = hendlers[handlerKey];
			return h({ path });
		}
		let filePath = rootDir + path;
		return new Response(await Bun.file(filePath).text(), {
			headers: {
				"Content-Type": "text/html",
			},
		});
	},
});
