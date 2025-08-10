export interface BuildContext {
    entrypoint: string;
    serviceFiles: string[];
    outDir: string;
    packageName: string;
    generatedFile: string;
    finalBuildFile: string;
    metadata?: any;
}

export type BuildStep = (context: BuildContext) => Promise<void>;