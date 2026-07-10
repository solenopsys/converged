import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  value: number;
  min?: number;
  max?: number;
  className?: string;
  ariaLabel?: string;
}

const joinClasses = (...parts: Array<string | undefined | false>) =>
  parts.filter(Boolean).join(' ');

export default function ProgressBar({
  value,
  min = 0,
  max = 100,
  className,
  ariaLabel,
}: ProgressBarProps) {
  const range = max - min;
  const safeRange = range === 0 ? 1 : range;
  const clampedValue = Math.min(Math.max(value, min), max);
  const ratio = ((clampedValue - min) / safeRange) * 100;
  const fillWidth = `${Math.max(0, Math.min(100, ratio))}%`;

  return (
    <div
      className={joinClasses(styles.progressBar, className)}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clampedValue}
    >
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: fillWidth }} />
      </div>
    </div>
  );
}
