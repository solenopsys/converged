// build.ts — исправленная версия с правильной загрузкой в S3
import { mkdirSync } from "fs";
import { join } from "path";
import { resolve } from 'path';
import { InterfaceParser } from '../../../nrpc/src/generator/parser';
import { FrontendGenerator } from '../../../nrpc/src/generator/frontend';
import { fileSize, uploadToS3 } from '../tools';
import { frontExternal } from '../conf';


// This script should be called from the root of the target project.
// Usage: bun run <path-to-this-script> <entrypoint> <serviceFile1> [serviceFile2...] <outDir>

if (process.argv.length < 5) {
    console.error('Usage: bun run <script> <entrypoint> <serviceFile1> [serviceFile2...] <outDir>');
    process.exit(1);
}

// --- Script Arguments ---
const entrypoint = process.argv[2];
const serviceFiles = process.argv.slice(3, -1).map(file => resolve(process.cwd(), file)); // All args between entrypoint and the last one
const outDir = resolve(process.cwd(), process.argv[process.argv.length - 1]); // Last argument is outDir

// --- Configuration ---
// Ensure the output directory exists
mkdirSync(outDir, { recursive: true });

// Load package.json from the directory where the command is run (process.cwd())
const packageJsonPath = resolve(process.cwd(), 'package.json');
const packageJson = await Bun.file(packageJsonPath).json();
const packageName = packageJson.name;

// Define intermediate file paths
const generatedFile = resolve(outDir, 'generated.ts');
const finalBuildFile = resolve(outDir, packageName + ".js");

async function run() {
    try {
        // Step 1: Parse service definition files
        console.log('Step 1: Parsing service files...');
        const parser = new InterfaceParser();
        const metadata = parser.parseInterface(serviceFiles[0]); // Assuming one service file for now
        console.log('✅ Parsing complete.');

        // Step 2: Generate backend RPC code
        console.log('Step 2: Generating frontend code...');
        const backendGenerator = new FrontendGenerator();
        const backendConfig = {
            transport: 'http' as const,
            servicePath: entrypoint,
            metadata: metadata
        };
        backendGenerator.generateFrontend(metadata, generatedFile);
        console.log('✅ Frontend code generated.');

        // Step 3: Build the final application 
  
        console.log('Step 3: Building the project...');
      
        const entry = join("src", "index.ts");
        const outName = `${packageName}.js`; // Убираем лишний слэш
        const outPath = join("dist", outName);
      
``
        const buildResult = await Bun.build({
            entrypoints: [entry],
            outdir: "./dist",
            naming: outName,
            format: "esm",
            minify: true,
            sourcemap: "linked",
            target: "browser",
            external: frontExternal,
            jsx: "automatic"
        });

        if (!buildResult.success) {
            console.error("Build failed:", buildResult.logs);
            throw new Error("Bun build failed.");
        }

        console.log(`🧩 ${outName} - ${fileSize(outPath)}`);


    
        // Step 4: Upload to S3
        console.log('Step 4: Uploading to S3...');
        await uploadToS3("front",finalBuildFile);
        
        console.log('🚀 All steps completed successfully!');

    } catch (error) {
        console.error('❌ Build process failed:', error);
        process.exit(1);
    }
}



await run();



