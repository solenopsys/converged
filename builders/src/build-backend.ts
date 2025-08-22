import { runBuild, createContext } from './builder';
import { parseService, generateBackend, buildProject, uploadS3 } from './build-steps';
import { backExternal } from './conf';

if (process.argv.length < 5) {
    console.error('Usage: bun run <script> <entrypoint> <serviceFile1> [serviceFile2...] <outDir> [--upload]');
    process.exit(1);
}

// Проверяем наличие флага --upload
const upload = process.argv.includes('--upload');

// Фильтруем аргументы, исключая флаг --upload
const args = process.argv.slice(2).filter(arg => arg !== '--upload');

if (args.length < 3) {
    console.error('Usage: bun run <script> <entrypoint> <serviceFile1> [serviceFile2...] <outDir> [--upload]');
    process.exit(1);
}

const entrypoint = args[0];
const outDir = args[args.length - 1];
const serviceFiles = args.slice(1, -1);

const steps = [
    parseService,
    generateBackend,
    buildProject(backExternal)
];

if (upload) {
    steps.push(uploadS3('back'));
}

try {
    const context = await createContext(entrypoint, serviceFiles, outDir);
    await runBuild(steps, context);
} catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
}