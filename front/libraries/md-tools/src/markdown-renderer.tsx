import React from "react";
import type { JSX } from "react";
import type { MarkdownASTNode } from "./types";

interface MdBlockProps {
  node: MarkdownASTNode;
  className?: string;
  key?: React.Key;
}

function cn(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

export function MarkdownRenderer({
  ast,
  className,
}: {
  ast: MarkdownASTNode;
  className?: string;
}) {
  return (
    <div className={cn("markdown-content", className)}>
      <MdBlock node={ast} />
    </div>
  );
}

function MdBlock({ node }: MdBlockProps): React.ReactNode {
  if (!node) return null;

  if (node.type === "text") {
    return node.text || "";
  }

  const children = node.children?.map((child, index) => (
    <MdBlock key={index} node={child} />
  ));

  const typeMap: Record<string, string> = {
    paragraph: "p",
    heading: "h",
    emphasis: "em",
    list: "ul",
    listItem: "li",
    break: "br",
    softbr: "br",
    quote: "blockquote",
  };

  const type = typeMap[node.type] || node.type;

  switch (type) {
    case "root":
    case "doc":
      return <>{children}</>;

    case "p":
      return (
        <p className="leading-7 [&:not(:first-child)]:mt-4 mb-4">{children}</p>
      );

    case "strong":
      return <strong className="font-semibold">{children}</strong>;

    case "em":
      return <em>{children}</em>;

    case "h": {
      const level = node.details?.level || 1;
      const Tag = `h${level}` as React.ElementType;
      const classNames: Record<number, string> = {
        1: "mt-8 scroll-m-20 text-4xl font-bold tracking-tight lg:text-5xl first:mt-0 mb-6",
        2: "mt-10 scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0 mb-4",
        3: "mt-8 scroll-m-20 text-2xl font-semibold tracking-tight mb-3",
        4: "mt-6 scroll-m-20 text-xl font-semibold tracking-tight mb-2",
        5: "mt-4 scroll-m-20 text-lg font-semibold tracking-tight mb-2",
        6: "mt-4 scroll-m-20 text-base font-semibold tracking-tight mb-2",
      };
      return <Tag className={classNames[level]}>{children}</Tag>;
    }

    case "a": {
      const href = node.details?.href || "#";
      return (
        <a
          href={href}
          className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        >
          {children}
        </a>
      );
    }

    case "img":
      return (
        <img
          src={node.details?.src || ""}
          alt={node.details?.alt || ""}
          className="max-w-full h-auto rounded-lg my-4"
        />
      );

    case "code":
      return (
        <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold text-foreground">
          {node.text || children}
        </code>
      );

    case "code_block":
      return (
        <pre className="mb-4 mt-6 overflow-x-auto rounded-lg border bg-muted p-4">
          <code className="relative font-mono text-sm">
            {node.text || children}
          </code>
        </pre>
      );

    case "blockquote":
      return (
        <blockquote className="mt-6 border-l-2 border-primary pl-6 italic text-muted-foreground">
          {children}
        </blockquote>
      );

    case "ul": {
      const isTight = node.details?.is_tight;
      return (
        <ul className="my-6 ml-6 list-disc [&>li]:mt-2" data-tight={isTight}>
          {children}
        </ul>
      );
    }

    case "ol":
      return <ol className="my-6 ml-6 list-decimal [&>li]:mt-2">{children}</ol>;

    case "li":
      return <li>{children}</li>;

    case "hr":
      return <hr className="my-8 border-border" />;

    case "table":
      return (
        <div className="my-6 w-full overflow-y-auto">
          <table className="w-full">{children}</table>
        </div>
      );

    case "thead":
      return <thead>{children}</thead>;

    case "tbody":
      return <tbody>{children}</tbody>;

    case "tr":
      return <tr className="m-0 border-t p-0 even:bg-muted">{children}</tr>;

    case "th":
      return (
        <th className="border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right">
          {children}
        </th>
      );

    case "td":
      return (
        <td className="border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right">
          {children}
        </td>
      );

    case "br":
      return <br />;

    case "del":
      return <del>{children}</del>;

    case "u":
      return <u>{children}</u>;

    case "html":
      return <div dangerouslySetInnerHTML={{ __html: node.text || "" }} />;

    default:
      console.warn(`Unknown markdown node type: ${node.type}`);
      return <>{children}</>;
  }
}
