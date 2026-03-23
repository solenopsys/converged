import { LandingPage } from "./pages/LandingPage";
import type { SitemapEntry } from "../ssr/sitemap";
import { SUPPORTED_LOCALES, buildLocalePath } from "./i18n";

export const appRoutes = [
  { path: "/:locale/", element: <LandingPage /> },
];

export const appSitemapRoutes: SitemapEntry[] = SUPPORTED_LOCALES.flatMap((locale) => ([
  { path: buildLocalePath(locale, "/"), changefreq: "weekly", priority: 1 },
]));
