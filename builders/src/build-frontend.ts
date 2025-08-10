import { runBuild, createContext } from './builder';
import { parseService, generateFrontend, buildFrontend, uploadS3, generateFrontendWrapper } from './build-steps';

 

if (process.argv.length < 5) {
    console.error('Usage: bun run <script> <entrypoint> <serviceFile1> [serviceFile2...] <outDir> --upload');
    process.exit(1);
}

const entrypoint = process.argv[2];
const serviceFiles = process.argv.slice(3, -1);
const outDir = process.argv[4];

const steps = [
    parseService,
    generateFrontend,
    generateFrontendWrapper("./dist/wrapper.ts"),
    buildFrontend({entry: "./dist/wrapper.ts", external: ["converged-core","react","react-dom","react-router-dom","sonner"]})
];

 


if(process.argv.includes('--upload')){
    steps.push(uploadS3('front'));
}

try {
    const context = await createContext(entrypoint, serviceFiles, outDir);
    await runBuild(steps, context);
} catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
}