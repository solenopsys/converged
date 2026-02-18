import { Home } from "./pages/Home";
import { About } from "./pages/About";
import type { SitemapEntry } from "../ssr/sitemap";

export const appRoutes = [
  { path: "/", element: <Home /> },
  { path: "/about", element: <About /> },
];

export const appSitemapRoutes: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: 1 },
  { path: "/about", changefreq: "monthly", priority: 0.6 },
];
