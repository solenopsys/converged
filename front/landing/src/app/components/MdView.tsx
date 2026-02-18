import { MarkdownRenderer, type MarkdownASTNode } from "md-tools";

interface MdViewProps {
  ast: MarkdownASTNode | null;
  error?: string;
  loading?: boolean;
}

export function MdView({ ast, error, loading }: MdViewProps) {
  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-red-400 mb-4">Error</h1>
        <p className="text-slate-300">{error}</p>
      </div>
    );
  }

  if (loading || !ast) {
    return (
      <div className="max-w-3xl mx-auto">
        <p className="text-slate-300">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto prose prose-invert">
      <MarkdownRenderer ast={ast} />
    </div>
  );
}
