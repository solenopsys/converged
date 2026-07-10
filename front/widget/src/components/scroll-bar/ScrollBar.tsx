import { type JSX } from 'preact';
import styles from './ScrollBar.module.css';

interface ScrollBarProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number) => void;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  thumbRatio?: number;
  minThumbPercent?: number;
}

const joinClasses = (...parts: Array<string | undefined | false>) =>
  parts.filter(Boolean).join(' ');

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

export default function ScrollBar({
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  className,
  ariaLabel,
  disabled = false,
  orientation = 'horizontal',
  thumbRatio = 1,
  minThumbPercent = 12,
}: ScrollBarProps) {
  const range = max - min;
  const clampedValue = clamp(value, min, max);
  const normalisedValue = range <= 0 ? 0 : (clampedValue - min) / range;

  const isVertical = orientation === 'vertical';

  let handleStyle: JSX.CSSProperties;

  if (isVertical) {
    const clampedRatio = clamp(Number.isFinite(thumbRatio) ? thumbRatio : 1, 0, 1);
    const clampedMinThumb = clamp(minThumbPercent, 0, 100);
    let thumbPercent = clamp(clampedRatio * 100, clampedMinThumb, 100);

    if (range <= 0) {
      thumbPercent = 100;
    }

    const travel = Math.max(0, 100 - thumbPercent);
    const positionPercent = travel === 0 ? 50 : thumbPercent / 2 + normalisedValue * travel;

    handleStyle = {
      top: `${positionPercent}%`,
      height: `${thumbPercent}%`,
    };
  } else {
    const positionPercent = normalisedValue * 100;
    handleStyle = { left: `${positionPercent}%` };
  }

  const handleInput = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement | null;
    if (!target) return;
    onValueChange?.(Number(target.value));
  };

  const orientationClass = isVertical ? styles.scrollBarVertical : undefined;

  return (
    <div
      className={joinClasses(styles.scrollBar, orientationClass, className)}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clampedValue}
      aria-orientation={orientation}
    >
      <div className={styles.track}>
        <div className={styles.handle} style={handleStyle} />
      </div>
      <input
        type="range"
        className={styles.rangeInput}
        min={min}
        max={max}
        step={step}
        value={clampedValue}
        onInput={handleInput}
        disabled={disabled}
        aria-label={ariaLabel}
        data-orientation={orientation}
      />
    </div>
  );
}
