import { describe, it, expect } from "bun:test";
import { mdToJson, MD_DIALECT_GITHUB } from "../src/index";

describe("MD4C Markdown to JSON AST", () => {
  it("should parse simple text", () => {
    const md = "Hello, World!";
    const ast = mdToJson(md);

    expect(ast).toBeDefined();
    expect(ast.type).toBe("root");
    expect(ast.children).toBeDefined();
    expect(ast.children!.length).toBeGreaterThan(0);
  });

  it("should parse headings", () => {
    const md = "# Heading 1\n## Heading 2";
    const ast = mdToJson(md);

    expect(ast).toBeDefined();
    expect(ast.children).toBeDefined();

    // MD4C wraps content in a "doc" node, so we need to look inside
    const jsonStr = JSON.stringify(ast);
    expect(jsonStr).toContain('"type":"h"');
    expect(jsonStr).toContain('"level":1');
    expect(jsonStr).toContain('"level":2');
  });

  it("should parse bold and italic", () => {
    const md = "This is **bold** and *italic* text.";
    const ast = mdToJson(md);

    expect(ast).toBeDefined();
    expect(JSON.stringify(ast)).toContain("strong");
    expect(JSON.stringify(ast)).toContain("em");
  });

  it("should parse lists", () => {
    const md = `
- Item 1
- Item 2
- Item 3
`;
    const ast = mdToJson(md);

    expect(ast).toBeDefined();
    const jsonStr = JSON.stringify(ast);
    expect(jsonStr).toContain("ul");
    expect(jsonStr).toContain("li");
  });

  it("should parse code blocks", () => {
    const md = "```javascript\nconst x = 42;\n```";
    const ast = mdToJson(md);

    expect(ast).toBeDefined();
    const jsonStr = JSON.stringify(ast);
    expect(jsonStr).toContain("code");
  });

  it("should parse links", () => {
    const md = "Check out [this link](https://example.com)";
    const ast = mdToJson(md);

    expect(ast).toBeDefined();
    const jsonStr = JSON.stringify(ast);
    expect(jsonStr).toContain("https://example.com");
  });

  it("should parse tables with GitHub dialect", () => {
    const md = `
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
`;
    const ast = mdToJson(md, { flags: MD_DIALECT_GITHUB });

    expect(ast).toBeDefined();
    const jsonStr = JSON.stringify(ast);
    expect(jsonStr).toContain("table");
  });

  it("should parse complex markdown document", () => {
    const md = `
# Main Title

This is a **complex** document with *various* elements.

## Section 1

- List item 1
- List item 2
  - Nested item

## Section 2

\`\`\`typescript
function hello(name: string) {
  return \`Hello, \${name}!\`;
}
\`\`\`

[Link to docs](https://example.com)
`;

    const ast = mdToJson(md);

    expect(ast).toBeDefined();
    expect(ast.type).toBe("root");
    expect(ast.children).toBeDefined();
    expect(ast.children!.length).toBeGreaterThan(0);

    // Verify structure is parseable
    const jsonStr = JSON.stringify(ast, null, 2);
    expect(jsonStr.length).toBeGreaterThan(100);

    // Verify it's valid JSON by parsing it back
    const parsed = JSON.parse(jsonStr);
    expect(parsed.type).toBe("root");
  });

  it("should output valid JSON structure", () => {
    const md = "# Test\n\nParagraph with **bold**.";
    const ast = mdToJson(md);

    // Should be able to serialize and parse
    const serialized = JSON.stringify(ast);
    const parsed = JSON.parse(serialized);

    expect(parsed.type).toBe("root");
    expect(parsed.children).toBeDefined();
  });
});
