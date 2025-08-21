import { build } from "bun";
import { injectInterface } from "../../api/src/build/inject-interface";

async function simpleBuild(name: string) {
    await build({
        entrypoints: ["./src/index.ts"],
        outdir: "dist",
        target: "node",
        format: "esm",
        minify: true,
        sourcemap: false,
        external: ["dag-api"],
        dts: true,
        splitting: true,
        bundle: true,
        plugins: [
            {
                name,
                setup(build) {
                    build.onLoad({ filter: /dag-api/ }, (args) => ({
                        contents: "export default {}",
                    }));
                },
            },
        ],
    });
}

export async function buildNode(moduleName: string, currentDir?: string) { 
    const beforeDir = process.cwd();

    try {
        // set Dir
        if (currentDir) {
            process.chdir(currentDir);
        }

        console.log('Building in directory:', process.cwd());

        await simpleBuild(moduleName);

        // inject inteface

        const code = await Bun.file(`./dist/index.js`).text();
        
        await injectInterface(`./src/index.ts`, `./dist/index.js`);
        
        console.log('Build completed successfully');
    } catch (error) {
        console.error('Build failed:', error);
        throw error;
    } finally {
        // set Dir back (всегда выполнится, даже при ошибке)
        process.chdir(beforeDir);
    }
}

// if main 
if (require.main === module) {
    buildNode('default-module').catch(console.error);
}