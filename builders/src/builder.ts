import { resolve } from 'path';
import { mkdirSync } from 'fs';
import { BuildStep, BuildContext } from './types';

export const runBuild = async (steps: BuildStep[], context: BuildContext) => {
    for (let i = 0; i < steps.length; i++) {
        console.log(`Step ${i + 1}:`);
        await steps[i](context);
    }
    console.log('🚀 All steps completed!');
};

export const createContext = async (entrypoint: string, serviceFiles: string[], outDir: string): Promise<BuildContext> => {
    mkdirSync(outDir, { recursive: true });
    
    const packageJson = await Bun.file(resolve(process.cwd(), 'package.json')).json();
    const packageName = packageJson.name;

    return {
        entrypoint,
        serviceFiles: serviceFiles.map(file => resolve(process.cwd(), file)),
        outDir: resolve(process.cwd(), outDir),
        packageName,
        generatedFile: resolve(outDir, 'generated.ts'),
        finalBuildFile: resolve(outDir, packageName + ".js")
    };
};