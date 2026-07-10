import capsizeModule, {
  type CapsizeOptions,
  type CapsizeStyles,
  type FontMetrics,
} from 'capsize';

export type TypographyDensity = 'default' | 'dense';

type CapsizeVars = Record<string, string>;

const interFontMetrics: FontMetrics = {
  capHeight: 1456,
  ascent: 2728,
  descent: -680,
  lineGap: 0,
  unitsPerEm: 2816,
};

const capsize = (
  typeof capsizeModule === 'function'
    ? capsizeModule
    : (capsizeModule as { default: (options: CapsizeOptions) => CapsizeStyles })
        .default
) as (options: CapsizeOptions) => CapsizeStyles;

const capsizeToVars = (prefix: string, styles: CapsizeStyles): CapsizeVars => ({
  [`--cvg-${prefix}-font-size`]: styles.fontSize,
  [`--cvg-${prefix}-line-height`]: styles.lineHeight,
  [`--cvg-${prefix}-before`]: styles['::before'].marginBottom,
  [`--cvg-${prefix}-after`]: styles['::after'].marginTop,
});

const toSpacingVars = (
  density: TypographyDensity,
): CapsizeVars => {
  if (density === 'dense') {
    return {
      '--cvg-markdown-block-spacing': 'var(--cvg-space-xs)',
      '--cvg-markdown-list-spacing': 'var(--cvg-space-xxs)',
      '--cvg-markdown-h1-spacing-top': 'var(--cvg-space-sm)',
      '--cvg-markdown-h1-spacing-bottom': 'var(--cvg-space-xs)',
      '--cvg-markdown-h2-spacing-top': 'var(--cvg-space-xs-plus)',
      '--cvg-markdown-h2-spacing-bottom': 'var(--cvg-space-xxs)',
      '--cvg-markdown-h3-spacing-top': 'var(--cvg-space-xs-plus)',
      '--cvg-markdown-h3-spacing-bottom': 'var(--cvg-space-xxs)',
    };
  }

  return {
    '--cvg-markdown-block-spacing': 'var(--cvg-space-xs-plus)',
    '--cvg-markdown-list-spacing': 'var(--cvg-space-xxs)',
    '--cvg-markdown-h1-spacing-top': 'var(--cvg-space-sm-plus)',
    '--cvg-markdown-h1-spacing-bottom': 'var(--cvg-space-xs-plus)',
    '--cvg-markdown-h2-spacing-top': 'var(--cvg-space-sm)',
    '--cvg-markdown-h2-spacing-bottom': 'var(--cvg-space-xs)',
    '--cvg-markdown-h3-spacing-top': 'var(--cvg-space-sm)',
    '--cvg-markdown-h3-spacing-bottom': 'var(--cvg-space-xs)',
  };
};

const createMarkdownVars = (
  density: TypographyDensity,
): CapsizeVars => {
  const bodyLeading = density === 'dense' ? 20 : 22;
  const heading1Leading = density === 'dense' ? 28 : 32;
  const heading2Leading = density === 'dense' ? 24 : 28;
  const heading3Leading = density === 'dense' ? 22 : 24;

  return {
    ...capsizeToVars(
      'markdown-body',
      capsize({
        fontSize: 14,
        leading: bodyLeading,
        fontMetrics: interFontMetrics,
      }),
    ),
    ...capsizeToVars(
      'markdown-h1',
      capsize({
        fontSize: 24,
        leading: heading1Leading,
        fontMetrics: interFontMetrics,
      }),
    ),
    ...capsizeToVars(
      'markdown-h2',
      capsize({
        fontSize: 20,
        leading: heading2Leading,
        fontMetrics: interFontMetrics,
      }),
    ),
    ...capsizeToVars(
      'markdown-h3',
      capsize({
        fontSize: 18,
        leading: heading3Leading,
        fontMetrics: interFontMetrics,
      }),
    ),
    ...toSpacingVars(density),
  };
};

const markdownVarsCache: Record<TypographyDensity, CapsizeVars> = {
  default: createMarkdownVars('default'),
  dense: createMarkdownVars('dense'),
};

export const getMarkdownCapsizeVars = (
  density: TypographyDensity = 'default',
): CapsizeVars => ({
  ...markdownVarsCache[density],
});
