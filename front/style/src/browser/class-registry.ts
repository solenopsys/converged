// Registry for collecting utility classes from h() calls
export const classes = new Set<string>();

export function registerClass(cls: string | undefined | null) {
  if (!cls) return;
  cls.split(/\s+/).forEach(c => {
    if (c) classes.add(c);
  });
}

export function getClasses(): string[] {
  return [...classes];
}

export function clearClasses() {
  classes.clear();
}
