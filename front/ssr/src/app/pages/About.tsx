import { Link } from "react-router-dom";
import { Button, Card, CardContent, CardHeader, CardTitle } from "front-core/components";

export function About() {
  return (
    <div className="min-h-screen bg-[var(--ui-background)] text-[var(--ui-foreground)]">
      <div className="px-8 py-20">
        <Card className="max-w-2xl bg-[var(--ui-card)] text-[var(--ui-card-foreground)]">
          <CardHeader>
            <CardTitle>About this SSR package</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-[var(--ui-muted-foreground)]">
            <p>
              This is a placeholder page using front-core shadcn components with UnoCSS
              tokens.
            </p>
            <Button asChild variant="outline">
              <Link to="/">Back to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
