import { Home } from "./pages/Home";
import { About } from "./pages/About";
import type { SitemapEntry } from "../ssr/sitemap";
import { SUPPORTED_LOCALES, buildLocalePath } from "./i18n";

export const appRoutes = [
  { path: "/:locale/", element: <Home /> },
  { path: "/:locale/about", element: <About /> },
];

export const appSitemapRoutes: SitemapEntry[] = SUPPORTED_LOCALES.flatMap((locale) => ([
  { path: buildLocalePath(locale, "/"), changefreq: "weekly", priority: 1 },
  { path: buildLocalePath(locale, "/about"), changefreq: "monthly", priority: 0.6 },
]));
