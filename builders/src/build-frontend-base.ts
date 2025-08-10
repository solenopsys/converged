import { runBuild, createContext } from './builder';
import { parseService, generateFrontend, buildProject, uploadS3 } from './build-steps';

const serviceFiles = process.argv.slice(2, -1);
const outDir = process.argv[process.argv.length - 1];

const steps = [
    parseService,
    generateFrontend 
];

try {
    const context = await createContext('', serviceFiles, outDir);
    await runBuild(steps, context);
} catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
}