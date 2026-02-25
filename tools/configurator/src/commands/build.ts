import { resolve } from "path";
import { mkdir, rm, writeFile } from "fs/promises";
import type { BuildConfig, GeneratorContext } from "../types";
import { resolvePreset } from "../resolver";
import { generateContainerfiles } from "../generators/containerfile";
import { generateKubernetesManifests } from "../generators/kubernetes";
import { generateRuntimeConfigs } from "../generators/server";


const PROJECTS_DIR = resolve(import.meta.dir, "../../../../../");

export interface BuildOptions {
  projectName: string;
  preset: string;
  outputDir: string;
  namespace?: string;
}

async function loadConfig(projectDir: string): Promise<BuildConfig> {
  const configPath = resolve(projectDir, "config.json");
  const file = Bun.file(configPath);
  if (!(await file.exists())) {
    throw new Error(`Config not found: ${configPath}`);
  }
  return await file.json() as BuildConfig;
}

export async function runBuild({
  projectName,
  preset,
  outputDir,
  namespace,
}: BuildOptions) {
  const projectDir = resolve(PROJECTS_DIR, projectName);
  const config = await loadConfig(projectDir);
  const targetNamespace = namespace || config.name;

  let parentDir: string | undefined;
  let mergedConfig = config;

  if (config.extends) {
    parentDir = resolve(PROJECTS_DIR, config.extends);
    const parentConfig = await loadConfig(parentDir);

    mergedConfig = {
      ...config,
      baseImage: config.baseImage || parentConfig.baseImage,
      spa: {
        core: config.spa.core || parentConfig.spa.core,
        microfrontends: [
          ...parentConfig.spa.microfrontends,
          ...config.spa.microfrontends,
        ],
      },
      back: {
        core: config.back.core || parentConfig.back.core,
        microservices: {
          ...parentConfig.back.microservices,
          ...config.back.microservices,
        },
      },
      runtimeDeps: config.runtimeDeps ?? parentConfig.runtimeDeps,
      storage: {
        ...parentConfig.storage,
        ...config.storage,
        overrides: {
          ...parentConfig.storage?.overrides,
          ...config.storage?.overrides,
        },
      },
    };


  }

  console.log(`Project: ${projectName}`);
  console.log(`Preset:  ${preset}`);

  const containers = resolvePreset(
    mergedConfig,
    preset,
    projectName,
    parentDir ? config.extends! : undefined,
  );

  console.log(`Resolved ${containers.length} container(s):`);
  for (const c of containers) {
    console.log(
      `  - ${c.name}: ${c.microservices.length} services, ${c.microfrontends.length} MFs, spa=${c.spa}, landing=${c.landing}`,
    );
  }

  // Output goes into deployment/{preset}/
  const presetDir = resolve(outputDir, preset);

  const ctx: GeneratorContext = {
    config: mergedConfig,
    preset,
    namespace: targetNamespace,
    containers,
    outputDir: resolve(presetDir),
    projectDir,
    parentProjectDir: parentDir,
    storage: mergedConfig.storage,
  };

  // Create output directories
  const containersDir = resolve(presetDir, "containers");
  const helmDir = resolve(presetDir, "helm");
  await mkdir(containersDir, { recursive: true });
  await mkdir(helmDir, { recursive: true });

  // Generate Containerfiles
  console.log("\nGenerating Containerfiles...");
  const containerfiles = await generateContainerfiles(ctx);
  for (const [filename, content] of containerfiles) {
    const path = resolve(containersDir, filename);
    await writeFile(path, content);
    console.log(`  ${path}`);
  }

  // Generate Helm chart templates via cdk8s
  console.log("\nGenerating Helm chart...");
  await rm(resolve(helmDir, "templates"), { recursive: true, force: true });
  await mkdir(resolve(helmDir, "templates"), { recursive: true });

  // Write Chart.yaml
  const chartYaml = `apiVersion: v2
name: ${ctx.config.name}
description: ${ctx.config.description || ctx.config.name}
type: application
version: 1.0.0
appVersion: "1.0.0"
`;
  await writeFile(resolve(helmDir, "Chart.yaml"), chartYaml);

  // Write values.yaml with defaults
  const registry = mergedConfig.registry;
  const imageName = registry ? `${registry}/${projectName}` : `localhost/${projectName}`;
  const pullPolicy = registry ? "Always" : "Never";
  const valuesYaml = `ingress:
  host: ${targetNamespace}.test

image:
  name: ${imageName}
  tag: latest
  pullPolicy: ${pullPolicy}
`;
  await writeFile(resolve(helmDir, "values.yaml"), valuesYaml);

  // cdk8s synth writes templates directly
  generateKubernetesManifests(ctx);
  console.log(`  ${helmDir}`);

  // Package Helm chart as .tgz
  console.log("\nPackaging Helm chart...");
  const chartName = `${ctx.config.name}-${preset}-1.0.0.tgz`;
  const chartPath = resolve(presetDir, chartName);

  const proc = Bun.spawn(
    ["tar", "-czf", chartPath, "-C", helmDir, "."],
    { stdout: "inherit", stderr: "inherit" },
  );
  await proc.exited;

  if (proc.exitCode === 0) {
    console.log(`  ${chartPath}`);
  } else {
    console.error("  Failed to create archive");
  }

  // Generate K3s HelmChart CRD with embedded chart
  console.log("\nGenerating K3s HelmChart CRD...");
  const chartBytes = await Bun.file(chartPath).arrayBuffer();
  const chartBase64 = Buffer.from(chartBytes).toString("base64");
  generateKubernetesManifests(ctx, chartBase64);
  console.log(`  ${resolve(presetDir, "k3s-chart.yaml")}`);

  // Generate runtime configs (per-container config.json with service host map)
  console.log("\nGenerating runtime configs...");
  const configsDir = resolve(presetDir, "configs");
  await mkdir(configsDir, { recursive: true });
  const runtimeConfigs = generateRuntimeConfigs(ctx);
  for (const [filename, content] of runtimeConfigs) {
    const path = resolve(configsDir, filename);
    await writeFile(path, content);
    console.log(`  ${path}`);
  }

  // Summary
  const summary = {
    project: projectName,
    preset,
    generatedAt: new Date().toISOString(),
    containers: containers.map((c) => ({
      name: c.name,
      landing: c.landing,
      spa: c.spa,
      microfrontends: c.microfrontends.map((m) => m.name),
      microservices: c.microservices.map((s) => `${s.category}/${s.name}`),
    })),
    storage: mergedConfig.storage,
    ingress: mergedConfig.ingress,
  };

  const summaryPath = resolve(presetDir, "summary.json");
  await writeFile(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`\nSummary: ${summaryPath}`);

  console.log("\nBuild complete!");
}
