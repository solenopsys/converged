import { marked } from 'marked';
import styles from './TypographyMarkdown.module.css';
import { getMarkdownCapsizeVars, type TypographyDensity } from '../../shared/typography/capsize.ts';

interface TypographyMarkdownProps {
  source: string;
  className?: string;
  isBracketed?: boolean;
  emptyFallback?: string;
  density?: TypographyDensity;
}

const joinClasses = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export default function TypographyMarkdown({
  source,
  className,
  isBracketed = false,
  emptyFallback = '...',
  density = 'default',
}: TypographyMarkdownProps) {
  const content = source?.trim() ? source : emptyFallback;
  const html = marked.parse(content, { async: false }) as string;
  const typographyVars = getMarkdownCapsizeVars(density);

  return (
    <div
      className={joinClasses(styles.markdown, isBracketed && styles.markdownBracketed, className)}
      style={typographyVars}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
