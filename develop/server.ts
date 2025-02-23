import { Elysia, t } from "elysia";
import BuildController from "./services/build_controller";




function typeMap(type: string) {
	switch (type) {
		case "js":
			return "application/javascript";
		case "json":
			return "application/json";
		case "html":
			return "text/html";
		case "css":
			return "text/css";
		case "svg":
			return "image/svg+xml";
		case "png":
			return "image/png";
		case "jpg":
			return "image/jpeg";
		default:
			return "application/octet-stream";
	}
}

export function serverInit(port: number, bsDir: string, rootDir: string,currentHash:string,buildController:BuildController,configMapConvert:any ){
    new Elysia()
    .get("/", async ({ set }) => {
        console.log("READ ", currentHash);
        // Read the cached file
        const { buffer, type, compressed } =
            await buildController.cc.readFile(currentHash);
     
        // Set response headers
        set.headers = {
            "Content-Type": typeMap(type),
        };
    
        // Add compression header if content is compressed
        if (compressed) {
            set.headers["Content-Encoding"] = "br";
        }
    
        return buffer;
    })
    .get("/dht/:key", async ({ params, set }) => {
        const { buffer, type, compressed } = await buildController.cc.readFile(
            params.key,
        );
    
        // Set response headers
        set.headers = {
            "Content-Type": typeMap(type),
        };
    
        // Add compression header if content is compressed
        if (compressed) {
            set.headers["Content-Encoding"] = "br";
        }
    
        return buffer;
    })
    .get("/map/:key", async ({ params, set }) => {
        const conf = await buildController.cc.getImportConf(params.key);
    
        const map = await configMapConvert(conf);
    
        set.headers = {
            "Content-Type": "application/json",
        };
    
        console.log("map", map);
        return JSON.stringify(map);
    })
    
    .listen(port, () => {
        console.log(`Server is running on http://localhost:${port}  ${bsDir}`);
    });
}
