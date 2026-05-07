import { LandingPage } from "./pages/LandingPage";
import { RequestPage } from "./pages/RequestPage";
import type { SitemapEntry } from "../ssr/sitemap";
import { SUPPORTED_LOCALES, buildLocalePath } from "./i18n";

export const appRoutes = [
  { path: "/request/:requestId", element: <RequestPage /> },
  { path: "/:locale/", element: <LandingPage /> },
  { path: "/:locale/request/:requestId", element: <RequestPage /> },
];

export const appSitemapRoutes: SitemapEntry[] = SUPPORTED_LOCALES.flatMap((locale) => ([
  { path: buildLocalePath(locale, "/"), changefreq: "weekly", priority: 1 },
]));
