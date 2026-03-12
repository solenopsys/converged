import { defineConfig } from "vite";
import UnoCSS from "unocss/vite";
import path from "path";
import fs from "fs";

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
const microfrontendsDir = path.resolve(__dirname, "../../front/microfrontends");

const resolveMicrofrontendEntry = (name: string) => {
  const directTs = path.join(microfrontendsDir, name, "src", "index.ts");
  if (fs.existsSync(directTs)) return directTs;
  const directTsx = path.join(microfrontendsDir, name, "src", "index.tsx");
  if (fs.existsSync(directTsx)) return directTsx;
  if (!fs.existsSync(microfrontendsDir)) return null;

  for (const group of fs.readdirSync(microfrontendsDir, { withFileTypes: true })) {
    if (!group.isDirectory()) continue;
    const groupedTs = path.join(microfrontendsDir, group.name, name, "src", "index.ts");
    if (fs.existsSync(groupedTs)) return groupedTs;
    const groupedTsx = path.join(microfrontendsDir, group.name, name, "src", "index.tsx");
    if (fs.existsSync(groupedTsx)) return groupedTsx;
  }

  return null;
};

export default defineConfig({
  plugins: [
    {
      name: "resolve-microfrontends",
      resolveId(id) {
        if (!id.startsWith("/mf/") || !id.endsWith(".js")) return null;
        const rawName = id.slice("/mf/".length, -".js".length);
        return resolveMicrofrontendEntry(rawName);
      },
    },
    UnoCSS(),
  ],
  resolve: {
    alias: {
      "md-tools": path.resolve(__dirname, "../../front/libraries/md-tools/src"),
      "front-landings": path.resolve(__dirname, "../../../../../saas/public/front/front-landings/src"),
      "front-core/components": path.resolve(__dirname, "../../front/front-core/src"),
      "front-core": path.resolve(__dirname, "../../front/front-core/src/index.ts"),
      "@": path.resolve(__dirname, "../../front/front-core/src"),
      nrpc: path.resolve(__dirname, "../../tools/integration/nrpc/src"),
      "integration/types": path.resolve(__dirname, "../../tools/integration/types"),
      "g-oauth": path.resolve(__dirname, "./src/mocks/g-oauth.ts"),
      sonner: path.resolve(__dirname, "./src/mocks/sonner.ts"),
      ...(effectorPath ? { effector: effectorPath } : {}),
      ...(effectorReactPath ? { "effector-react": effectorReactPath } : {}),
      ...(emblaCarouselPath ? { "embla-carousel": emblaCarouselPath } : {}),
      ...(emblaCarouselReactPath ? { "embla-carousel-react": emblaCarouselReactPath } : {}),
      ...(emblaCarouselAutoplayPath ? { "embla-carousel-autoplay": emblaCarouselAutoplayPath } : {}),
    },
  },
});
