export interface MarkdownASTNode {
  type: string;
  text?: string;
  details?: Record<string, any>;
  children?: MarkdownASTNode[];
}
