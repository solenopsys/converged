import { resolve } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { InterfaceParser } from '../../../nrpc/src/generator/parser';
import { BackendGenerator } from '../../../nrpc/src/generator/backend';
import { uploadToS3 } from '../tools';
import { backExternal } from '../conf';


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
        console.log('Step 2: Generating backend code...');
        const backendGenerator = new BackendGenerator();
        const backendConfig = {
            transport: 'http' as const,
            servicePath: entrypoint,
            metadata: metadata
        };
        backendGenerator.generateBackend(backendConfig, generatedFile);
        console.log('✅ Backend code generated.');

        // Step 3: Build the final application
        console.log('Step 3: Building the project...');
        const buildResult = await Bun.build({
            entrypoints: [generatedFile],
            outdir: outDir,
            target: 'node',
            external: backExternal,
            minify: true,
        });

        if (!buildResult.success) {
            console.error("Build failed:", buildResult.logs);
            throw new Error("Bun build failed.");
        }

        // The output file is generated.js, but we want packageName.js.
        await Bun.$`mv ${resolve(outDir, 'generated.js')} ${finalBuildFile}`;
        console.log(`✅ Build complete: ${finalBuildFile}`);

        // Step 4: Upload to S3
        console.log('Step 4: Uploading to S3...');
        await uploadToS3("back",finalBuildFile);
        
        console.log('🚀 All steps completed successfully!');

    } catch (error) {
        console.error('❌ Build process failed:', error);
        process.exit(1);
    }
}



await run();