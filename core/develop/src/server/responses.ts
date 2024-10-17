import { indexBuild } from "../tools/html";
import { existsSync } from "fs";

async function jsToResponse(jsFile: string) {
	console.log("JS TO RESPONSE", jsFile);
	// todo it hotfi bun bug
	const headers = {
		"Content-Type": "application/javascript",
	};
	const file = await Bun.file(jsFile).arrayBuffer();
	return new Response(file, { headers });
}

async function indexResponse(
	dirPath: string,
	dirBs: string,
): Promise<Response> {
	const htmlContent: string = await indexBuild(dirPath, dirBs);

	return new Response(htmlContent, {
		headers: {
			"Content-Type": "text/html",
		},
	});
}

function fileResponse(filePath: string): Response {
	if (existsSync(filePath)) {
		const file = Bun.file(filePath);
		return new Response(file);
	} else {
		console.log("Not found", filePath);
		return new Response("Not Found", { status: 404 });
	}
}

async function remoteResponse(host: string, path: string): Promise<Response> {
	const remoteUrl = host + path;
	console.log("REMOTE URL", remoteUrl);
	const data = await fetch(remoteUrl);
	const buffer = await data.arrayBuffer();
	return new Response(buffer, {
		headers: {
			"Content-Type": "application/json",
		},
	});
}

export { fileResponse, jsToResponse, remoteResponse, indexResponse };
