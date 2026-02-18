type ToastOptions = {
  description?: string;
};

const noop = (_message?: string, _options?: ToastOptions) => {};

export const toast = {
  success: noop,
  error: noop,
  info: noop,
  warning: noop,
};

export type ToasterProps = {
  className?: string;
  toastOptions?: Record<string, unknown>;
  [key: string]: unknown;
};

export function Toaster(_props: ToasterProps) {
  return null;
}
