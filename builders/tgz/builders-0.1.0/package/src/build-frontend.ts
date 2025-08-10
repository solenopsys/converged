import { runBuild, createContext } from './builder';
import { parseService, generateFrontend, buildProject, uploadS3 } from './build-steps';

if (process.argv.length < 5) {
    console.error('Usage: bun run <script> <entrypoint> <serviceFile1> [serviceFile2...] <outDir>');
    process.exit(1);
}

const entrypoint = process.argv[2];
const serviceFiles = process.argv.slice(3, -1);
const outDir = process.argv[process.argv.length - 1];

const steps = [
    parseService,
    generateFrontend,
    buildProject([]),
    uploadS3('front')
];

try {
    const context = await createContext(entrypoint, serviceFiles, outDir);
    await runBuild(steps, context);
} catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
}