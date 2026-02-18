import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import UnoCSS from "unocss/vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const bunDirs = [
  path.resolve(__dirname, "../../node_modules/.bun"),
  path.resolve(__dirname, "../../../../node_modules/.bun"),
];

const resolveBunPackage = (name: string, version: string) => {
  const prefix = `${name}@${version}`;
  for (const bunDir of bunDirs) {
    if (!fs.existsSync(bunDir)) continue;
    const match = fs
      .readdirSync(bunDir)
      .find((entry) => entry === prefix || entry.startsWith(`${prefix}+`));
    if (match) return path.join(bunDir, match, "node_modules", name);
  }
  return undefined;
};

const effectorPath = resolveBunPackage("effector", "23.4.4");
const effectorReactPath = resolveBunPackage("effector-react", "23.3.0");
const emblaCarouselPath = resolveBunPackage("embla-carousel", "8.6.0");
const emblaCarouselReactPath = resolveBunPackage("embla-carousel-react", "8.6.0");
const emblaCarouselAutoplayPath = resolveBunPackage("embla-carousel-autoplay", "8.6.0");
const preactCompatPath = fileURLToPath(import.meta.resolve("preact/compat"));
const preactJsxRuntimePath = fileURLToPath(import.meta.resolve("preact/jsx-runtime"));
const preactJsxDevRuntimePath = fileURLToPath(import.meta.resolve("preact/jsx-dev-runtime"));
const lucidePreactPath = fileURLToPath(import.meta.resolve("lucide-preact"));
const microfrontendsDir = path.resolve(__dirname, "../../front/microfrontends");

export default defineConfig({
  plugins: [
    {
      name: "resolve-preact-compat",
      resolveId(id) {
        if (id === "preact/compat") return preactCompatPath;
        if (id === "preact/jsx-runtime") return preactJsxRuntimePath;
        if (id === "preact/jsx-dev-runtime") return preactJsxDevRuntimePath;
        return null;
      },
    },
    {
      name: "resolve-microfrontends",
      resolveId(id) {
        if (!id.startsWith("/mf/") || !id.endsWith(".js")) return null;
        const rawName = id.slice("/mf/".length, -".js".length);
        const mfPath = path.join(microfrontendsDir, rawName, "src", "index.ts");
        if (fs.existsSync(mfPath)) return mfPath;
        const tsxPath = path.join(microfrontendsDir, rawName, "src", "index.tsx");
        if (fs.existsSync(tsxPath)) return tsxPath;
        return null;
      },
    },
    preact(),
    UnoCSS(),
  ],
  resolve: {
    alias: {
      "md-tools": path.resolve(__dirname, "../../front/libraries/md-tools/src"),
      "front-landings": path.resolve(__dirname, "../../../../../saas/public/front/front-landings/src"),
      "front-core/components": path.resolve(__dirname, "../../front/front-core/src/index.ts"),
      "front-core": path.resolve(__dirname, "../../front/front-core/src/index.ts"),
      "framer-motion": path.resolve(__dirname, "./src/widget-design/shims/framer-motion.tsx"),
      "@": path.resolve(__dirname, "../../front/front-core/src"),
      widget: path.resolve(__dirname, "../../front/widget/src"),
      nrpc: path.resolve(__dirname, "../../tools/integration/nrpc/src"),
      "integration/types": path.resolve(__dirname, "../../tools/integration/types"),
      "g-oauth": path.resolve(__dirname, "./src/mocks/g-oauth.ts"),
      sonner: path.resolve(__dirname, "./src/mocks/sonner.ts"),
      react: preactCompatPath,
      "react-dom": preactCompatPath,
      "lucide-react": lucidePreactPath,
      "lucide-preact": lucidePreactPath,
      "react/jsx-runtime": preactJsxRuntimePath,
      "react/jsx-dev-runtime": preactJsxDevRuntimePath,
      "preact/compat": preactCompatPath,
      "preact/jsx-runtime": preactJsxRuntimePath,
      "preact/jsx-dev-runtime": preactJsxDevRuntimePath,
      ...(effectorPath ? { effector: effectorPath } : {}),
      ...(effectorReactPath ? { "effector-react": effectorReactPath } : {}),
      ...(emblaCarouselPath ? { "embla-carousel": emblaCarouselPath } : {}),
      ...(emblaCarouselReactPath ? { "embla-carousel-react": emblaCarouselReactPath } : {}),
      ...(emblaCarouselAutoplayPath ? { "embla-carousel-autoplay": emblaCarouselAutoplayPath } : {}),
    },
  },
});
