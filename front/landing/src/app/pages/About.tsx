import { Link, useParams } from "react-router-dom";
import { Button } from "front-core";
import { DEFAULT_LOCALE, buildLocalePath, isSupportedLocale } from "../i18n";

export function About() {
  const { locale } = useParams<{ locale: string }>();
  const activeLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;

  return (
    <div className="min-h-screen">
      <div className="px-6 py-20">
        <h1 className="text-5xl font-bold mb-6">About</h1>
        <p className="text-xl text-slate-300 mb-8">
          This page is server-side rendered and hydrated on the client.
        </p>
        <Button asChild>
          <Link to={buildLocalePath(activeLocale, "/")}>Back to Home</Link>
        </Button>
      </div>
    </div>
  );
}
