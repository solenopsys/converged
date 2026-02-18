import { type ComponentChildren } from 'preact';
import { type JSX } from 'preact/jsx-runtime';

interface DesignContainerProps {
  children: ComponentChildren;
  style?: JSX.CSSProperties;
}

const baseStyle: JSX.CSSProperties = {
  padding: '24px',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  background: '#fafafa',
  color: '#111',
  minHeight: '100vh',
  boxSizing: 'border-box',
};

export default function DesignContainer({ children, style }: DesignContainerProps) {
  return (
    <main style={{ ...baseStyle, ...style }}>
      {children}
    </main>
  );
}
