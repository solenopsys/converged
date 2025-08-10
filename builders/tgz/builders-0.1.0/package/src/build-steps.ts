export const uploadS3 = (bucket: string = 'back'): BuildStep => async (context) => {
    console.log('Uploading to S3...');
    await uploadToS3(bucket, context.finalBuildFile);
    console.log('✅ Upload complete.');
};import { join } from 'path';
import { fileSize } from './tools';import { resolve } from 'path';
import { InterfaceParser } from '../../nrpc/src/generator/parser';
import { BackendGenerator } from '../../nrpc/src/generator/backend';
import { FrontendGenerator } from '../../nrpc/src/generator/frontend'; // Добавил фронтенд генератор
import { uploadToS3 } from './tools';
import { BuildStep, BuildContext } from './types';

export const parseService: BuildStep = async (context) => {
    console.log('Parsing service files...');
    const parser = new InterfaceParser();
    context.metadata = parser.parseInterface(context.serviceFiles[0]);
    console.log('✅ Parsing complete.');
};

export const generateBackend: BuildStep = async (context) => {
    console.log('Generating backend code...');
    const generator = new BackendGenerator();
    generator.generateBackend({
        transport: 'http' as const,
        servicePath: context.entrypoint,
        metadata: context.metadata
    }, context.generatedFile);
    console.log('✅ Backend code generated.');
};

export const generateFrontend: BuildStep = async (context) => {
    console.log('Generating frontend code...');
    const generator = new FrontendGenerator();
    generator.generateFrontend(context.metadata, context.generatedFile);
    console.log('✅ Frontend code generated.');
};

export const buildProject = (external: string[] = []): BuildStep => async (context) => {
    console.log('Building project...');
    const result = await Bun.build({
        entrypoints: [context.generatedFile],
        outdir: context.outDir,
        target: 'node',
        external,
        minify: true,
    });

    if (!result.success) {
        throw new Error(`Build failed: ${result.logs}`);
    }

    await Bun.$`mv ${resolve(context.outDir, 'generated.js')} ${context.finalBuildFile}`;
    console.log('✅ Build complete.');
};

export const buildFrontend = (external: string[] = []): BuildStep => async (context) => {
    console.log('Building project...');
    
    const entry = join("src", "index.ts");
    const outName = `${context.packageName}.js`;
    const outPath = join("dist", outName);
    
    const result = await Bun.build({
        entrypoints: [entry],
        outdir: "./dist",
        naming: outName,
        format: "esm",
        minify: true,
        sourcemap: "linked",
        target: "browser",
        external,
        jsx: "automatic"
    });

    if (!result.success) {
        throw new Error(`Build failed: ${result.logs}`);
    }

    console.log(`🧩 ${outName} - ${fileSize(outPath)}`);
    console.log('✅ Build complete.');
};