#!/usr/bin/env bun
/**
 * Configurator CLI
 *
 * Usage:
 *   bun run cli.ts dev --project=converged-portal|club-portal
 *   bun run cli.ts build --project=converged-portal|club-portal --preset=mono|micro|scale
 */
import { parseArgs } from "util";

const { positionals, values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    project: { type: "string", short: "p" },
    preset: { type: "string", default: "mono" },
    output: { type: "string", short: "o", default: "./deployment" },
    namespace: { type: "string", short: "n" },
    port: { type: "string", default: "3000" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

const command = positionals[0];

if (values.help || !command) {
  console.log(`
Configurator — Dev server and build generator

Usage:
  bun run cli.ts <command> [options]

Commands:
  dev     Start development server (all services + frontend)
  build   Generate Containerfiles and Kubernetes manifests

Options:
  -p, --project <name>  Project: converged-portal | club-portal (required)
  --preset <name>       Build preset: mono | micro | scale (default: mono)
  -o, --output <dir>    Output directory for build (default: ./deployment)
  -n, --namespace <ns>  K8s namespace (default: config name)
  --port <port>         Dev server base port (default: 3000)
  -h, --help            Show this help

Examples:
  bun run cli.ts dev --project=converged-portal
  bun run cli.ts dev --project=club-portal --port=3001
  bun run cli.ts build --project=converged-portal --preset=mono
  bun run cli.ts build --project=club-portal --preset=micro
  bun run cli.ts build --project=club-portal --preset=scale
`);
  process.exit(values.help ? 0 : 1);
}

const VALID_PROJECTS = ["converged-portal", "club-portal"];

if (!values.project || !VALID_PROJECTS.includes(values.project)) {
  console.error(
    `Error: --project must be one of: ${VALID_PROJECTS.join(", ")}`,
  );
  process.exit(1);
}

async function main() {
  switch (command) {
    case "dev": {
      const { runDev } = await import("./commands/dev");
      await runDev({
        projectName: values.project!,
        port: parseInt(values.port!, 10),
      });
      break;
    }

    case "build": {
      const { runBuild } = await import("./commands/build");
      await runBuild({
        projectName: values.project!,
        preset: values.preset!,
        outputDir: values.output!,
        namespace: values.namespace,
      });
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.error("Use --help for usage information");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
