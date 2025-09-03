import { buildNode } from "./build-node";
import { createDagServiceClient } from "./dat-api/generated";

const dagClient = createDagServiceClient({ baseUrl: 'http://localhost:3001' });

async function fileSize(filePath: string): Promise<number> {
    const stats = await Bun.file(filePath).stat();
    return stats.size;
}

async function buildStep(moduleName: string, packagePath: string) {
    await buildNode(moduleName, packagePath);
    const resultFile = `${packagePath}/dist/index.js`;
    const size = await fileSize(resultFile);
    console.log(size, " Byte");
}

async function deployStep(moduleName: string, resultFile: string) {
    const code = await dagClient.setNodeCode(moduleName, await Bun.file(resultFile).text());
    console.log(code);
    return code;
}

async function makeNodeStep(moduleName: string, config: any) {
    // replace env 

    const configEnvs = Object.fromEntries(
        Object.entries(config).map(([key, value]) => [
            key, 
            typeof value === 'string' && value.startsWith('$') 
                ? process.env[value.slice(1)] 
                : value
        ])
    );

    console.log("CONF",configEnvs);

    const node = await dagClient.createNode(moduleName, configEnvs);
    console.log(node);
    return node.hash;
}

async function runNodeStep(hash: string, params: any) {
    const result = await dagClient.runCode(hash, params);
    console.log(result);
    return result;
}

export async function runModule(moduleName: string, config: any, inputParams: any) {
    const packagePath = `./packages/${moduleName}`;
    const resultFile = `${packagePath}/dist/index.js`;
    
    await buildStep(moduleName, packagePath);
    console.log("build completed");
    await deployStep(moduleName, resultFile);
    console.log("deploy completed");
    const hash = await makeNodeStep(moduleName, config);
    console.log("node created");
    return await runNodeStep(hash, inputParams);

}

// если запуск из CLI
if (process.argv[2]) {
    const name=process.argv[2]
    const config = JSON.parse(await Bun.file(`./packages/${name}/test.json`).text());
    console.log(config);
    await runModule(name, config.node, config.data);
}