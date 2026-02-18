import { bundle } from "lightningcss";

const STYLE_RUNTIME_MODULE = "__mf_style_runtime__";

interface CreateLightningCssPluginOptions {
  scopeName: string;
  minify?: boolean;
}

function toLiteral(value: string): string {
  return JSON.stringify(value);
}

function escapeForTemplate(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

export function createLightningCssPlugin(
  options: CreateLightningCssPluginOptions,
): Bun.BunPlugin {
  const minify = options.minify ?? true;
  const styleTagId = `mf-style-${options.scopeName}`;

  return {
    name: `mf-lightningcss-${options.scopeName}`,
    setup(build) {
      build.onResolve({ filter: /^__mf_style_runtime__$/ }, () => ({
        path: STYLE_RUNTIME_MODULE,
        namespace: "mf-style-runtime",
      }));

      build.onLoad({ filter: /.*/, namespace: "mf-style-runtime" }, () => ({
        contents: `
const STYLE_TAG_ID = ${toLiteral(styleTagId)};
const injected = new Set();

export function injectStyle(text) {
  if (typeof document === "undefined" || !text) return;
  if (injected.has(text)) return;
  injected.add(text);

  let styleTag = document.getElementById(STYLE_TAG_ID);
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = STYLE_TAG_ID;
    document.head.appendChild(styleTag);
  }

  styleTag.appendChild(document.createTextNode(text));
}
`,
        loader: "js",
      }));

      build.onLoad({ filter: /\.module\.css$/ }, ({ path }) => {
        const result = bundle({
          filename: path,
          minify,
          sourceMap: false,
          cssModules: true,
        });

        const exportsMap = (result as any).exports ?? {};
        let contents = "";
        const dependencies = new Map<string, string>();

        const importDependency = (specifier: string): string => {
          const cached = dependencies.get(specifier);
          if (cached) return cached;
          const alias = `dependency_${dependencies.size}`;
          contents = `import ${alias} from ${toLiteral(specifier)};\n${contents}`;
          dependencies.set(specifier, alias);
          return alias;
        };

        contents += `import { injectStyle } from "${STYLE_RUNTIME_MODULE}";\n`;
        contents += `injectStyle(${toLiteral(result.code.toString())});\n`;
        contents += "export default {";

        for (const [className, classExport] of Object.entries(exportsMap)) {
          const entry = classExport as any;
          let compiled = `"${escapeForTemplate(entry.name)}`;

          if (Array.isArray(entry.composes)) {
            for (const composition of entry.composes) {
              if (
                composition?.type === "local" ||
                composition?.type === "global"
              ) {
                compiled += ` ${escapeForTemplate(composition.name)}`;
                continue;
              }
              if (composition?.type === "dependency") {
                const depAlias = importDependency(composition.specifier);
                compiled += ` " + ${depAlias}[${toLiteral(composition.name)}] + "`;
              }
            }
          }

          compiled += '"';
          contents += `${toLiteral(className)}:${compiled},`;
        }

        contents += "};";

        return {
          contents,
          loader: "js",
        };
      });

      build.onLoad({ filter: /^(?!.*\.module\.css$).*\.css$/ }, ({ path }) => {
        const result = bundle({
          filename: path,
          minify,
          sourceMap: false,
          cssModules: false,
        });

        return {
          contents: `
import { injectStyle } from "${STYLE_RUNTIME_MODULE}";
injectStyle(${toLiteral(result.code.toString())});
export default {};
`,
          loader: "js",
        };
      });
    },
  };
}
