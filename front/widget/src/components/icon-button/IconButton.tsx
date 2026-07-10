import { type FunctionalComponent, type JSX } from 'preact';
import styles from './IconButton.module.css';

export enum ButtonSize {
  Small = 4*8,
  Medium = 4*12,
  Large = 4*14,
}

interface IconButtonProps {
  onClick: () => void;
  icon: FunctionalComponent<{ size?: number; strokeWidth?: number; color?: string }>;
  size?: ButtonSize;
  ariaLabel?: string;
  disabled?: boolean;
}

export const IconButton = ({
  onClick,
  icon: Icon,
  size = ButtonSize.Medium,
  ariaLabel = 'Иконка',
  disabled = false,
}: IconButtonProps) => {
  const edge = size;
  const iconSize = Math.max(16, Math.round(edge * 0.45));
  const buttonStyle: JSX.CSSProperties = {
    width: `${edge}px`,
    height: `${edge}px`,
  };

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      className={styles.iconButton}
      aria-label={ariaLabel}
      disabled={disabled}
      style={buttonStyle}
    >
      <Icon size={iconSize} strokeWidth={1.8} color="currentColor" />
    </button>
  );
};
