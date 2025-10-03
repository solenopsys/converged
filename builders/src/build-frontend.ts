import { runBuild, createContext } from './builder';
import { parseService, generateFrontend, buildFrontend, uploadS3,uploadS3Locale, generateFrontendWrapper } from './build-steps';
import { fileSize } from './tools';

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
    generateFrontend,
    generateFrontendWrapper("./dist/wrapper.ts"),
    buildFrontend({
        entry: "./dist/wrapper.ts", 
        external: ["converged-core", "react", "react-dom", "react-router-dom", "sonner", "recharts","effector","effector-react"]
    })
];

if (upload) {
    steps.push(uploadS3('front',false));
    steps.push(uploadS3Locale('front/locale'));
}

try {
    const context = await createContext(entrypoint, serviceFiles, outDir);
    await runBuild(steps, context);
} catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
}