import type { ReactNode } from "react";

interface DocumentProps {
  children: ReactNode;
  title?: string;
}

export function Document({ children, title = "SSR" }: DocumentProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <div id="root">{children}</div>
        <script type="module" src="/client.js" />
      </body>
    </html>
  );
}
