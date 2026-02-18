import { Link } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "front-core/components";

export function Home() {
  return (
    <div className="min-h-screen bg-[var(--ui-background)] text-[var(--ui-foreground)]">
      <div className="px-8 py-20">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.4em] text-[var(--ui-muted-foreground)]">
              SSR Starter
            </p>
            <h1 className="text-5xl font-black leading-tight">
              Base layout for any SSR site
            </h1>
            <p className="text-lg text-[var(--ui-muted-foreground)]">
              React Router + Elysia SSR with UnoCSS and shadcn-style components from
              front-core.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/about">Read more</Link>
              </Button>
              <Button variant="outline">Primary action</Button>
            </div>
          </div>
          <Card className="bg-[var(--ui-card)] text-[var(--ui-card-foreground)]">
            <CardHeader>
              <CardTitle>UI controls</CardTitle>
              <CardDescription>
                This stub uses shadcn components to match the shared design system.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-[var(--ui-border)] p-4">
                <p className="text-sm text-[var(--ui-muted-foreground)]">
                  Replace this section with real content blocks.
                </p>
              </div>
              <Button variant="secondary" className="w-full">
                Secondary action
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
