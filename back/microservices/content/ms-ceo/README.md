# ms-ceo

SEO JSON storage microservice. Structure is aligned with `ms-struct`, but intended for SEO metadata templates and route patterns.

## Data layout

- `data/en/files/*.json`
- `data/ru/files/*.json`

Each JSON can contain:

- `defaults`: fallback title/keywords templates
- `routes[]`: URL regex patterns with exact `title`/`keywords` or templates (`titleTemplate`, `keywordsTemplate`)
