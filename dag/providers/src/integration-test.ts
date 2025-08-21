import { buildProvider } from "./build-provider";
import { createDagServiceClient } from "./dat-api/generated";

const dagClient = createDagServiceClient({ baseUrl: 'http://localhost:3001' });

async function fileSize(filePath: string): Promise<number> {
    const stats = await Bun.file(filePath).stat();
    return stats.size;
}

async function buildStep(moduleName: string, packagePath: string) {
    await buildProvider(moduleName, packagePath);
    const resultFile = `${packagePath}/dist/index.js`;
    const size = await fileSize(resultFile);
    console.log(size, " Byte");
}

async function deployStep(moduleName: string, resultFile: string) {
    const code = await dagClient.setProviderCode(moduleName, await Bun.file(resultFile).text());
    console.log(code);
    return code;
}

async function makeProviderStep(providerName: string, providerCodeName: string, config: any) {
    const node = await dagClient.createProvider(providerName,providerCodeName, config);
    console.log(node);
    return node.hash;
}

 
export async function runProvider(moduleName: string, config: any ) {
    const packagePath = `./packages/${moduleName}`;
    const resultFile = `${packagePath}/dist/index.js`;
    
    await buildStep(moduleName, packagePath);
    console.log("build completed");
    await deployStep(moduleName, resultFile);
    console.log("deploy completed");
    const hash = await makeProviderStep(config.name, moduleName, config);
    console.log("provider created");
    return hash;

}

// если запуск из CLI
if (process.argv[2]) {
    const name=process.argv[2]
    const config = JSON.parse(await Bun.file(`./packages/${name}/test.json`).text());
    console.log(config);
    await runProvider(name, config.provider);
}